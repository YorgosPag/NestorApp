import { pool } from "./customers-db";

// 🗄️ RAW SQL QUERIES — V2 Project Customers API
//
// Εξήχθηκαν από το route.ts (κανόνας N.7.1: API routes ≤300 γραμμές, το route.ts
// είχε φτάσει τις 450). Περιέχει:
//   (1) το κύριο JOIN query που καλεί ο GET handler (fetchProjectCustomers)
//   (2) δύο βοηθητικά query functions (getCustomerDetails, getProjectAnalytics) που
//       ΔΕΝ είναι συνδεδεμένα με κάποιο ενεργό Next.js route (καμία αναφορά αλλού
//       στο codebase κατά τον έλεγχο του split) — διατηρούνται αυτούσια όπως ήταν
//       στο αρχικό route.ts, χωρίς αλλαγή συμπεριφοράς.

/**
 * Εκτελεί το κύριο JOIN query για τους πελάτες ενός έργου.
 * ⚡ ENTERPRISE QUERY - Single JOIN query αντί 20+ Firebase calls
 */
export async function fetchProjectCustomers(projectId: string) {
  const query = `
    WITH project_info AS (
      SELECT
        p.id,
        p.name,
        p.status,
        COUNT(DISTINCT b.id) as buildings_count,
        COUNT(DISTINCT u.id) as total_units_count
      FROM projects p
      LEFT JOIN buildings b ON b.project_id = p.id
      LEFT JOIN units u ON u.building_id = b.id
      WHERE p.id = $1
      GROUP BY p.id, p.name, p.status
    ),
    customer_aggregates AS (
      SELECT
        c.id as contact_id,
        c.contact_type,
        c.display_name,
        c.email,
        c.phone,
        c.mobile,
        COUNT(u.id) as units_count,
        SUM(COALESCE(u.sale_price, 0)) as total_value,
        AVG(COALESCE(u.sale_price, 0)) as avg_unit_value,
        MIN(u.sale_date) as first_purchase_date,

        -- Delivery Status Calculation
        COUNT(CASE WHEN u.delivery_date IS NOT NULL THEN 1 END) as delivered_units,
        COUNT(CASE WHEN u.delivery_date IS NULL AND u.status = 'sold' THEN 1 END) as pending_units,

        -- Property Details JSON Aggregation
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'propertyId', u.id,
            'propertyNumber', u.unit_number,
            'floor', u.floor,
            'areaSqm', u.area_sqm,
            'propertyType', u.unit_type,
            'salePrice', u.sale_price,
            'saleDate', u.sale_date,
            'deliveryDate', u.delivery_date,
            'buildingName', b.name
          ) ORDER BY b.name, u.unit_number
        ) as units_details
      FROM projects p
      JOIN buildings b ON b.project_id = p.id
      JOIN units u ON u.building_id = b.id
      JOIN contacts c ON c.id = u.sold_to
      WHERE p.id = $1
        AND u.status = 'sold'
        AND u.sold_to IS NOT NULL
        AND c.status = 'active'
      GROUP BY c.id, c.contact_type, c.display_name, c.email, c.phone, c.mobile
    )
    SELECT
      pi.*,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'contactId', ca.contact_id,
            'name', ca.display_name,
            'email', ca.email,
            'phone', ca.phone,
            'mobile', ca.mobile,
            'contactType', ca.contact_type,
            'propertiesCount', ca.units_count,
            'totalValue', ca.total_value,
            'averageUnitValue', ca.avg_unit_value,
            'purchaseDate', ca.first_purchase_date,
            'deliveredUnits', ca.delivered_units,
            'pendingUnits', ca.pending_units,
            'deliveryStatus',
              CASE
                WHEN ca.delivered_units = ca.units_count THEN 'completed'
                WHEN ca.delivered_units > 0 THEN 'partial'
                ELSE 'pending'
              END,
            'unitsDetails', ca.units_details
          ) ORDER BY ca.display_name
        ) FILTER (WHERE ca.contact_id IS NOT NULL),
        '[]'::json
      ) as customers_data,

      -- Summary Statistics
      COUNT(ca.contact_id) as total_customers,
      COALESCE(SUM(ca.units_count), 0) as total_units_sold,
      COALESCE(SUM(ca.total_value), 0) as total_sales_value,
      COALESCE(AVG(ca.total_value), 0) as average_sale_value,
      COALESCE(SUM(ca.delivered_units), 0) as delivery_complete_count,
      COALESCE(SUM(ca.pending_units), 0) as pending_delivery_count

    FROM project_info pi
    LEFT JOIN customer_aggregates ca ON true
    GROUP BY pi.id, pi.name, pi.status, pi.buildings_count, pi.total_units_count;
  `;

  return pool.query(query, [projectId]);
}

// 🔧 ADDITIONAL ENTERPRISE ENDPOINTS

// GET /api/v2/projects/[projectId]/customers/[customerId]
// - Single customer detailed view με όλες τις purchases
export async function getCustomerDetails(
  projectId: string,
  customerId: string,
) {
  const query = `
    SELECT
      c.*,
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'propertyId', u.id,
          'propertyNumber', u.unit_number,
          'buildingName', b.name,
          'floor', u.floor,
          'areaSqm', u.area_sqm,
          'salePrice', u.sale_price,
          'saleDate', u.sale_date,
          'deliveryDate', u.delivery_date,
          'status', u.status
        ) ORDER BY u.sale_date DESC
      ) as purchase_history
    FROM contacts c
    JOIN units u ON u.sold_to = c.id
    JOIN buildings b ON b.id = u.building_id
    JOIN projects p ON p.id = b.project_id
    WHERE p.id = $1 AND c.id = $2
    GROUP BY c.id;
  `;

  return pool.query(query, [projectId, customerId]);
}

// GET /api/v2/projects/[projectId]/analytics
// - Advanced analytics με spatial data
export async function getProjectAnalytics(projectId: string) {
  const query = `
    WITH sales_analytics AS (
      SELECT
        DATE_TRUNC('month', u.sale_date) as sale_month,
        COUNT(*) as units_sold,
        SUM(u.sale_price) as monthly_revenue,
        AVG(u.sale_price) as avg_unit_price,
        AVG(u.area_sqm) as avg_unit_size
      FROM units u
      JOIN buildings b ON b.id = u.building_id
      WHERE b.project_id = $1 AND u.status = 'sold'
      GROUP BY DATE_TRUNC('month', u.sale_date)
      ORDER BY sale_month
    ),
    spatial_analytics AS (
      SELECT
        b.name as building_name,
        COUNT(u.id) as total_units,
        COUNT(CASE WHEN u.status = 'sold' THEN 1 END) as sold_units,
        COUNT(CASE WHEN u.status = 'available' THEN 1 END) as available_units,
        SUM(CASE WHEN u.status = 'sold' THEN u.sale_price ELSE 0 END) as building_revenue,
        ST_AsGeoJSON(b.building_footprint) as building_geometry
      FROM buildings b
      LEFT JOIN units u ON u.building_id = b.id
      WHERE b.project_id = $1
      GROUP BY b.id, b.name, b.building_footprint
    )
    SELECT
      (SELECT JSON_AGG(sa.*) FROM sales_analytics sa) as sales_trends,
      (SELECT JSON_AGG(spa.*) FROM spatial_analytics spa) as building_analytics;
  `;

  return pool.query(query, [projectId]);
}
