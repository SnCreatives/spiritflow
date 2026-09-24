/* LOCKED BRAND ASSET — DO NOT MODIFY */
/**
 * Official LiquorFlow Brand Logo Asset
 * Source Reference: lfLogo.png
 * Proportions, gradients, geometry, and styling are locked and preserved.
 */

import React from 'react';

interface LiquorFlowLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showSubtitle?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export const LiquorFlowLogo: React.FC<LiquorFlowLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  showSubtitle = true,
  orientation = 'horizontal',
}) => {
  // Dimensions based on size
  const iconSizes = {
    xs: { w: 24, h: 24 },
    sm: { w: 36, h: 36 },
    md: { w: 48, h: 48 },
    lg: { w: 64, h: 64 },
    xl: { w: 96, h: 96 },
  };

  const { w, h } = iconSizes[size] || iconSizes.md;

  const IconSvg = (
    <svg
      viewBox="0 0 500 500"
      width={w}
      height={h}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-md select-none"
    >
      <defs>
        {/* Liquor Pouring Bottle Gradients */}
        <linearGradient id="lf_bottle_dark" x1="230" y1="100" x2="330" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#172554" />
          <stop offset="50%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        <linearGradient id="lf_bottle_liquid" x1="260" y1="110" x2="315" y2="135" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>

        {/* Drops Gradient */}
        <linearGradient id="lf_drop" x1="228" y1="140" x2="228" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>

        {/* Cocktail Glass Liquid Gradient */}
        <linearGradient id="lf_glass_liquid" x1="165" y1="160" x2="250" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="60%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>

        {/* Bar Chart Gradients */}
        <linearGradient id="lf_bar_1" x1="235" y1="200" x2="255" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="lf_bar_2" x1="260" y1="180" x2="280" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <linearGradient id="lf_bar_3" x1="285" y1="150" x2="310" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e40af" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <linearGradient id="lf_bar_4" x1="315" y1="130" x2="335" y2="130" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        {/* Flow Wave Gradients */}
        <linearGradient id="lf_wave_orange" x1="130" y1="220" x2="300" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="50%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>

        <linearGradient id="lf_wave_blue" x1="130" y1="240" x2="370" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="30%" stopColor="#0369a1" />
          <stop offset="70%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>

        <linearGradient id="lf_wave_blue_highlight" x1="220" y1="225" x2="365" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* 1. Bar Chart Bars Behind Glass */}
      <rect x="238" y="195" width="20" height="28" rx="2" fill="url(#lf_bar_1)" />
      <rect x="262" y="175" width="20" height="48" rx="2" fill="url(#lf_bar_2)" />
      <rect x="286" y="155" width="20" height="68" rx="2" fill="url(#lf_bar_3)" />
      <rect x="310" y="140" width="20" height="83" rx="2" fill="url(#lf_bar_4)" />

      {/* 2. Pouring Liquor Bottle */}
      <g id="lf_bottle">
        {/* Bottle Body */}
        <path
          d="M242 125 L320 102 C325 100 330 104 330 110 L326 128 C325 133 320 137 315 138 L250 148 C244 149 238 145 237 139 L236 131 C235 127 238 125 242 125 Z"
          fill="url(#lf_bottle_dark)"
        />
        {/* Bottle Neck / Cap */}
        <path
          d="M242 125 L234 126 C230 127 228 130 228 134 L228 137 C228 141 230 144 234 145 L242 144 Z"
          fill="#0f172a"
        />
        {/* Liquid inside bottle */}
        <path
          d="M260 118 L312 108 C316 107 320 110 320 114 L318 122 C317 125 314 127 310 128 L265 134 C260 135 256 132 255 128 L255 125 C254 121 257 118 260 118 Z"
          fill="url(#lf_bottle_liquid)"
        />
      </g>

      {/* 3. Pouring Liquid Drops */}
      <path
        d="M228 145 C228 145 224 153 224 156 C224 159 226 161 228 161 C230 161 232 159 232 156 C232 153 228 145 228 145 Z"
        fill="url(#lf_drop)"
      />

      {/* 4. Cocktail Glass */}
      <g id="lf_glass">
        {/* Glass Liquid Filling */}
        <path
          d="M188 164 L258 164 C256 172 232 208 223 208 C214 208 190 172 188 164 Z"
          fill="url(#lf_glass_liquid)"
        />

        {/* Effervescent bubbles */}
        <circle cx="210" cy="182" r="3" fill="#fef08a" opacity="0.8" />
        <circle cx="220" cy="190" r="2.5" fill="#fef08a" opacity="0.7" />
        <circle cx="228" cy="178" r="3.5" fill="#fef08a" opacity="0.9" />

        {/* Glass Top Liquid Surface Line */}
        <path
          d="M185 164 C190 160 256 160 261 164 C256 168 190 168 185 164 Z"
          fill="#fef08a"
        />

        {/* Glass Frame / Outer Rim */}
        <path
          d="M172 152 L220 215 L220 248 L200 252 C196 253 194 256 195 260 C196 264 200 266 205 266 L241 266 C246 266 250 264 251 260 C252 256 250 253 246 252 L226 248 L226 215 L274 152 C276 149 274 145 270 145 L176 145 C172 145 170 149 172 152 Z"
          fill="#0f172a"
        />
        {/* Glass Inner Cutout */}
        <path
          d="M182 153 L223 206 L264 153 Z"
          fill="#0f172a"
          opacity="0.15"
        />
      </g>

      {/* 5. Dynamic Flowing Waves */}
      {/* Orange Upper Wave */}
      <path
        d="M142 248 C160 225 210 215 250 235 C280 250 310 242 345 228 C320 245 285 262 245 250 C205 238 165 240 142 248 Z"
        fill="url(#lf_wave_orange)"
      />

      {/* Royal Blue Lower 3D Wave */}
      <path
        d="M140 255 C190 240 235 256 270 262 C320 270 365 245 378 178 C382 225 348 268 290 270 C240 272 185 262 140 255 Z"
        fill="url(#lf_wave_blue)"
      />
      {/* Wave Sheen / Highlight */}
      <path
        d="M245 256 C285 262 335 252 368 200 C360 232 320 262 270 262 C260 262 252 259 245 256 Z"
        fill="url(#lf_wave_blue_highlight)"
      />
    </svg>
  );

  if (!showText) {
    return <div className={`inline-flex items-center justify-center ${className}`}>{IconSvg}</div>;
  }

  return (
    <div
      className={`inline-flex ${
        orientation === 'vertical' ? 'flex-col items-center text-center' : 'items-center gap-3'
      } ${className}`}
    >
      {IconSvg}

      <div className={orientation === 'vertical' ? 'mt-2 flex flex-col items-center' : 'flex flex-col'}>
        <div className="flex items-baseline tracking-tight font-extrabold text-white select-none">
          <span className="text-amber-500 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 bg-clip-text text-transparent">
            Liquor
          </span>
          <span className="text-sky-500 bg-gradient-to-r from-sky-400 via-blue-600 to-indigo-700 bg-clip-text text-transparent">
            Flow
          </span>
        </div>

        {showSubtitle && (
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <span className="h-[1px] w-3 bg-gradient-to-r from-transparent to-slate-600" />
            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700/80 text-[10px] font-black tracking-widest text-slate-300 uppercase shadow-inner">
              ERP
            </span>
            <span className="h-[1px] w-3 bg-gradient-to-l from-transparent to-slate-600" />
          </div>
        )}
      </div>
    </div>
  );
};
