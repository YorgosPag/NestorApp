
import type { Property } from '@/types/property-viewer';
import type { Suggestion, Recommendation } from '@/types/suggestions';

// This is a simplified simulation. A real implementation would be more complex.
export const suggestionSystem = {
    analyzeFloorPlan: function(properties: Property[]): Suggestion[] {
        const suggestions: Suggestion[] = [];
        const unassignedProperties = properties.filter(p => !p.vertices || p.vertices.length === 0);

        unassignedProperties.forEach(property => {
            const suggestion = this.generateSuggestion(property, properties);
            if (suggestion.recommendations.length > 0) {
                suggestions.push(suggestion);
            }
        });
        
        return suggestions;
    },

    generateSuggestion: function(property: Property, allProperties: Property[]): Suggestion {
        const recommendations: Recommendation[] = [];

        // Rule 1: Similar properties should be near each other
        const similarProperties = allProperties.filter(p => 
            p.type === property.type && p.id !== property.id && p.vertices && p.vertices.length > 0
        );
        
        if (similarProperties.length > 0) {
            const totalVertices = similarProperties.flatMap(p => p.vertices);
            const avgX = totalVertices.reduce((sum, v) => sum + v.x, 0) / totalVertices.length;
            const avgY = totalVertices.reduce((sum, v) => sum + v.y, 0) / totalVertices.length;
            
            recommendations.push({
                type: 'proximity',
                message: `Τοποθετήστε κοντά σε άλλα ${this.getTypeLabel(property.type)}`,
                suggestedArea: { x: avgX, y: avgY, radius: 200 },
                priority: 'high'
            });
        }

        // Rule 2: Size-based placement
        if (property.area) {
            if (property.area < 50) {
                recommendations.push({
                    type: 'size',
                    message: 'Μικρό ακίνητο - προτείνεται τοποθέτηση σε γωνία ή πλαϊνό χώρο',
                    priority: 'medium'
                });
            } else if (property.area > 120) {
                recommendations.push({
                    type: 'size',
                    message: 'Μεγάλο ακίνητο - χρειάζεται κεντρικό χώρο',
                    priority: 'high'
                });
            }
        }
        
        // Rule 3: Floor-based suggestions
        if (property.floor === 0) {
            recommendations.push({
                type: 'floor',
                message: 'Ισόγειο - προτείνεται κοντά στην είσοδο',
                priority: 'medium'
            });
        }
        
        // Rule 4: Empty space detection (simplified for demo)
        recommendations.push({
            type: 'empty_space',
            message: 'Βρέθηκε κατάλληλος κενός χώρος',
            suggestedArea: { x: 500, y: 300, width: 100, height: 80 },
            priority: 'high'
        });

        return {
            propertyId: property.id,
            propertyName: property.name,
            propertyType: property.type,
            recommendations,
            score: this.calculateSuggestionScore(recommendations)
        };
    },
    
    calculateSuggestionScore: function(recommendations: Recommendation[]) {
        const weights = { high: 3, medium: 2, low: 1 };
        return recommendations.reduce((score, rec) => 
            score + weights[rec.priority], 0
        );
    },
    
    getTypeLabel: function(type: string): string {
        const labels: Record<string, string> = {
            'apartment': 'διαμερίσματα',
            'store': 'καταστήματα',
            'storage': 'αποθήκες',
            'maisonette': 'μεζονέτες'
        };
        return labels[type.toLowerCase()] || type;
    }
};
