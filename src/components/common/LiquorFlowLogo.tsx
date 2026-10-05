import React from 'react';

interface LiquorFlowLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variant?: 'full' | 'mark';
  theme?: 'light' | 'dark' | 'white';
}

export const LiquorFlowLogo: React.FC<LiquorFlowLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  theme = 'light',
}) => {
  const sizeMap = {
    xs: 'h-6',
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-16',
    xl: 'h-24',
    '2xl': 'h-32',
  };

  const height = sizeMap[size] || sizeMap.md;
  
  let src = '/branding/liquorflow-logo.svg';
  if (variant === 'mark') {
    src = '/branding/liquorflow-mark.svg';
  } else if (theme === 'dark' || theme === 'white') {
    src = '/branding/liquorflow-logo-white.svg';
  }

  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <img
        src={src}
        alt="LiquorFlow"
        className={`${height} w-auto object-contain select-none`}
        draggable={false}
      />
    </div>
  );
};
