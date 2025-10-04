'use client';

import React from 'react';

interface ProjectCardTitleProps {
  name: string;
  description?: string;
}

export function ProjectCardTitle({ name, description }: ProjectCardTitleProps) {
  return (
    <div>
      <h3 className="font-semibold text-lg leading-tight line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
        {name}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
      )}
    </div>
  );
}
