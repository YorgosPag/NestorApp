
export interface Recommendation {
    type: 'proximity' | 'size' | 'floor' | 'empty_space';
    message: string;
    suggestedArea?: {
        x: number;
        y: number;
        width?: number;
        height?: number;
        radius?: number;
    };
    priority: 'high' | 'medium' | 'low';
}

export interface Suggestion {
    propertyId: string;
    propertyName: string;
    propertyType: string;
    recommendations: Recommendation[];
    score: number;
}
