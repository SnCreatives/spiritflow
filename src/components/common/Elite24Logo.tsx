import React from 'react';
import { Building2 } from 'lucide-react';

interface Elite24LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const Elite24Logo: React.FC<Elite24LogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
}) => {
  const dimensions = {
    xs: { iconSize: 18, fontSize: 'text-sm' },
    sm: { iconSize: 24, fontSize: 'text-base' },
    md: { iconSize: 32, fontSize: 'text-xl' },
    lg: { iconSize: 48, fontSize: 'text-3xl' },
    xl: { iconSize: 64, fontSize: 'text-5xl' },
  };

  const { iconSize, fontSize } = dimensions[size] || dimensions.md;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="bg-amber-500 text-slate-950 rounded-lg flex items-center justify-center p-1 shadow-sm">
        <Building2 size={iconSize} strokeWidth={2.5} />
      </div>
      {showText && (
        <span className={`font-black tracking-tighter ${fontSize} text-white`}>
          Elite<span className="text-amber-500">24</span>
        </span>
      )}
    </div>
  );
};
