import type { EmailTemplate, EmailTemplateData, EmailTemplateType } from '@/types/email-templates';

export class EmailTemplatesService {
  
  // 🏠 RESIDENTIAL TEMPLATE
  private static residentialTemplate = (data: EmailTemplateData): string => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ακίνητο για την Οικογένειά σας - Nestor Construct</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 26px; font-weight: 700; }
        .header p { margin: 8px 0 0 0; opacity: 0.95; font-size: 15px; }
        .content { padding: 35px 25px; }
        .property-card { background: linear-gradient(145deg, #f8f9fa, #e9ecef); border-radius: 15px; padding: 25px; margin: 20px 0; border: 1px solid #e9ecef; }
        .property-title { font-size: 22px; font-weight: 700; color: #2c3e50; margin: 0 0 12px 0; }
        .property-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .detail-item { background: white; padding: 15px; border-radius: 10px; text-align: center; border: 1px solid #e9ecef; }
        .detail-icon { font-size: 20px; margin-bottom: 8px; }
        .detail-value { font-weight: 700; color: #2c3e50; font-size: 16px; }
        .detail-label { font-size: 12px; color: #6c757d; text-transform: uppercase; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 10px; font-weight: 700; margin: 25px 0; font-size: 16px; }
        .family-message { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 10px; padding: 20px; margin: 20px 0; }
        .footer { background: #f8f9fa; padding: 25px; text-align: center; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏠 Το Σπίτι των Ονείρων σας</h1>
            <p>Βρήκαμε το τέλειο ακίνητο για την οικογένειά σας!</p>
        </div>
        
        <div class="content">
            ${data.personalMessage ? `
            <div class="family-message">
                <strong>💝 Προσωπικό Μήνυμα:</strong><br>
                <em>"${data.personalMessage}"</em>
            </div>
            ` : ''}
            
            <div class="property-card">
                <h2 class="property-title">🏡 ${data.propertyTitle}</h2>
                
                ${data.propertyDescription ? `<p style="color: #555; margin: 15px 0; font-style: italic;">${data.propertyDescription}</p>` : ''}
                
                <div class="property-details">
                    ${data.propertyPrice ? `
                    <div class="detail-item">
                        <div class="detail-icon">💰</div>
                        <div class="detail-value">€${data.propertyPrice.toLocaleString()}</div>
                        <div class="detail-label">Τιμή</div>
                    </div>
                    ` : ''}
                    
                    ${data.propertyArea ? `
                    <div class="detail-item">
                        <div class="detail-icon">📐</div>
                        <div class="detail-value">${data.propertyArea} τ.μ.</div>
                        <div class="detail-label">Εμβαδόν</div>
                    </div>
                    ` : ''}
                    
                    ${data.propertyLocation ? `
                    <div class="detail-item">
                        <div class="detail-icon">📍</div>
                        <div class="detail-value">${data.propertyLocation}</div>
                        <div class="detail-label">Τοποθεσία</div>
                    </div>
                    ` : ''}
                </div>
                
                <div style="text-align: center;">
                    <a href="${data.propertyUrl}" class="cta-button" style="color: white;">
                        👨‍👩‍👧‍👦 Δείτε το Οικογενειακό Σπίτι
                    </a>
                </div>
            </div>
            
            <div style="background: #e8f5e8; padding: 20px; border-radius: 10px; text-align: center;">
                <h3 style="color: #27ae60; margin: 0 0 10px 0;">🌟 Γιατί να Επιλέξετε Nestor Construct;</h3>
                <p style="margin: 0; color: #2c3e50;">20+ χρόνια εμπειρίας στη δημιουργία ευτυχισμένων οικογενειών!</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Nestor Construct - Οικογενειακά Σπίτια</strong></p>
            <p>📧 info@nestorconstruct.gr | 📞 +30 210 123 4567</p>
            <p style="font-size: 11px; margin-top: 15px;">Στάλθηκε σε ${data.recipientEmail}</p>
        </div>
    </div>
</body>
</html>`;

  // 🏢 COMMERCIAL TEMPLATE  
  private static commercialTemplate = (data: EmailTemplateData): string => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Επαγγελματικό Ακίνητο - Nestor Construct</title>
    <style>
        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f6fa; }
        .container { max-width: 650px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); color: white; padding: 35px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 30px; }
        .property-card { border: 2px solid #3498db; border-radius: 8px; padding: 25px; margin: 20px 0; }
        .property-title { font-size: 20px; font-weight: 600; color: #2c3e50; margin: 0 0 10px 0; }
        .business-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; margin: 20px 0; }
        .business-item { background: #ecf0f1; padding: 15px; border-radius: 6px; text-align: center; }
        .cta-button { display: inline-block; background: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; }
        .professional-note { background: #d5dbdb; padding: 20px; border-radius: 6px; border-left: 4px solid #3498db; }
        .footer { background: #2c3e50; color: white; padding: 25px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏢 Επαγγελματική Ευκαιρία</h1>
            <p>Επενδυτικό ακίνητο για την επιχείρησή σας</p>
        </div>
        
        <div class="content">
            ${data.personalMessage ? `
            <div class="professional-note">
                <strong>💼 Επαγγελματικό Μήνυμα:</strong><br>
                <em>"${data.personalMessage}"</em>
            </div>
            ` : ''}
            
            <div class="property-card">
                <h2 class="property-title">🏢 ${data.propertyTitle}</h2>
                
                <div class="business-grid">
                    ${data.propertyPrice ? `
                    <div class="business-item">
                        <strong>💰 Επένδυση</strong><br>
                        €${data.propertyPrice.toLocaleString()}
                    </div>
                    ` : ''}
                    
                    ${data.propertyArea ? `
                    <div class="business-item">
                        <strong>📐 Εμβαδόν</strong><br>
                        ${data.propertyArea} τ.μ.
                    </div>
                    ` : ''}
                    
                    ${data.propertyLocation ? `
                    <div class="business-item">
                        <strong>📍 Τοποθεσία</strong><br>
                        ${data.propertyLocation}
                    </div>
                    ` : ''}
                </div>
                
                <div style="text-align: center; margin-top: 25px;">
                    <a href="${data.propertyUrl}" class="cta-button" style="color: white;">
                        📊 Ανάλυση Επένδυσης
                    </a>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Nestor Construct - Commercial Division</strong></p>
            <p>📧 commercial@nestorconstruct.gr | 📞 +30 210 123 4567</p>
        </div>
    </div>
</body>
</html>`;

  // ⭐ PREMIUM TEMPLATE
  private static premiumTemplate = (data: EmailTemplateData): string => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Premium Collection - Nestor Construct</title>
    <style>
        body { font-family: 'Georgia', serif; line-height: 1.7; color: #2c3e50; margin: 0; padding: 0; background: radial-gradient(ellipse at center, #f39c12 0%, #d35400 100%); }
        .container { max-width: 700px; margin: 30px auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 40px rgba(0,0,0,0.3); }
        .header { background: linear-gradient(135deg, #2c3e50 0%, #8e44ad 100%); color: white; padding: 50px 30px; text-align: center; position: relative; }
        .header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #f39c12, #e74c3c, #8e44ad); }
        .header h1 { margin: 0; font-size: 32px; font-weight: 300; letter-spacing: 2px; }
        .header .subtitle { font-size: 16px; opacity: 0.9; margin-top: 8px; }
        .content { padding: 40px 35px; }
        .luxury-card { background: linear-gradient(145deg, #fdfbfb, #ebedee); border-radius: 20px; padding: 35px; margin: 25px 0; border: 1px solid #ddd; position: relative; }
        .luxury-card::before { content: '⭐'; position: absolute; top: -15px; right: 20px; background: #f39c12; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; }
        .property-title { font-size: 28px; font-weight: 300; color: #2c3e50; margin: 0 0 15px 0; letter-spacing: 1px; }
        .luxury-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 20px; margin: 30px 0; }
        .luxury-item { background: white; padding: 20px; border-radius: 15px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .luxury-icon { font-size: 24px; margin-bottom: 10px; }
        .luxury-value { font-weight: 600; color: #2c3e50; font-size: 18px; margin: 5px 0; }
        .luxury-label { color: #7f8c8d; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .cta-premium { display: inline-block; background: linear-gradient(135deg, #f39c12 0%, #e74c3c 100%); color: white; padding: 18px 40px; text-decoration: none; border-radius: 30px; font-weight: 600; font-size: 16px; letter-spacing: 1px; margin: 30px 0; }
        .exclusive-message { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 15px; margin: 25px 0; text-align: center; }
        .footer { background: #2c3e50; color: white; padding: 30px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⭐ PREMIUM COLLECTION</h1>
            <p class="subtitle">Luxury Properties by Nestor Construct</p>
        </div>
        
        <div class="content">
            ${data.personalMessage ? `
            <div class="exclusive-message">
                <strong>✨ Exclusive Message:</strong><br>
                <em style="font-size: 16px;">"${data.personalMessage}"</em>
            </div>
            ` : ''}
            
            <div class="luxury-card">
                <h2 class="property-title">✨ ${data.propertyTitle}</h2>
                
                ${data.propertyDescription ? `
                <p style="color: #555; font-size: 16px; line-height: 1.8; font-style: italic; margin: 20px 0;">
                    ${data.propertyDescription}
                </p>
                ` : ''}
                
                <div class="luxury-details">
                    ${data.propertyPrice ? `
                    <div class="luxury-item">
                        <div class="luxury-icon">💎</div>
                        <div class="luxury-value">€${data.propertyPrice.toLocaleString()}</div>
                        <div class="luxury-label">Investment</div>
                    </div>
                    ` : ''}
                    
                    ${data.propertyArea ? `
                    <div class="luxury-item">
                        <div class="luxury-icon">🏛️</div>
                        <div class="luxury-value">${data.propertyArea} τ.μ.</div>
                        <div class="luxury-label">Living Space</div>
                    </div>
                    ` : ''}
                    
                    ${data.propertyLocation ? `
                    <div class="luxury-item">
                        <div class="luxury-icon">🌟</div>
                        <div class="luxury-value">${data.propertyLocation}</div>
                        <div class="luxury-label">Prime Location</div>
                    </div>
                    ` : ''}
                </div>
                
                <div style="text-align: center;">
                    <a href="${data.propertyUrl}" class="cta-premium" style="color: white;">
                        👑 Exclusive Viewing
                    </a>
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 15px; text-align: center; border: 2px solid #f39c12;">
                <h3 style="color: #f39c12; margin: 0 0 15px 0;">🏆 Premium Services Included</h3>
                <p style="margin: 0; color: #2c3e50;">Private viewings • Concierge service • Luxury amenities</p>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>Nestor Construct - Premium Division</strong></p>
            <p>📧 premium@nestorconstruct.gr | 📞 +30 210 123 4567</p>
            <p style="font-size: 12px; opacity: 0.8; margin-top: 15px;">Exclusively sent to ${data.recipientEmail}</p>
        </div>
    </div>
</body>
</html>`;

  // TEMPLATE DEFINITIONS
  static readonly templates: EmailTemplate[] = [
    {
      id: 'residential',
      name: '🏠 Residential',
      description: 'Φιλικό design για οικογένειες',
      icon: '🏠',
      htmlTemplate: this.residentialTemplate
    },
    {
      id: 'commercial', 
      name: '🏢 Commercial',
      description: 'Επαγγελματικό design για επιχειρήσεις',
      icon: '🏢',
      htmlTemplate: this.commercialTemplate
    },
    {
      id: 'premium',
      name: '⭐ Premium',
      description: 'Luxury design για premium ακίνητα',
      icon: '⭐',
      htmlTemplate: this.premiumTemplate
    }
  ];

  static getTemplate(templateId: EmailTemplateType): EmailTemplate | null {
    return this.templates.find(template => template.id === templateId) || null;
  }

  static getAllTemplates(): EmailTemplate[] {
    return this.templates;
  }

  static generateEmailHtml(templateId: EmailTemplateType, data: EmailTemplateData): string {
    const template = this.getTemplate(templateId);
    if (!template) {
      console.warn(`Template ${templateId} not found, using default`);
      return this.residentialTemplate(data); // Fallback to residential
    }
    return template.htmlTemplate(data);
  }
}
