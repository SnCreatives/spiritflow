import React from 'react';

interface LiquorFlowLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'full' | 'mark';
}

export const LiquorFlowLogo: React.FC<LiquorFlowLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
}) => {
  const sizeMap = {
    xs: 'h-6',
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-16',
    xl: 'h-24',
    '2xl': 'h-32',
  };

  const height = sizeMap[size] || sizeMap.md;
  const src = variant === 'full' ? '/branding/liquorflow-logo.svg' : '/branding/liquorflow-mark.svg';

  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <img
        src={src}
        alt="LiquorFlow ERP"
        className={`${height} w-auto object-contain select-none`}
        draggable={false}
      />
    </div>
  );
};
