/* OFFICIAL BRAND ASSET — HIGH-QUALITY VECTOR SVG LOGO */
/**
 * Official LiquorFlow ERP Brand Logo Component
 * Grounded directly in lFlogo.png vector artwork.
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
  // Dimensions map
  const dimensions = {
    xs: { iconW: 28, iconH: 28, textClass: 'text-sm', badgeClass: 'text-[9px] px-1.5 py-0.2' },
    sm: { iconW: 36, iconH: 36, textClass: 'text-base', badgeClass: 'text-[10px] px-2 py-0.5' },
    md: { iconW: 52, iconH: 52, textClass: 'text-xl', badgeClass: 'text-xs px-2.5 py-0.5' },
    lg: { iconW: 72, iconH: 72, textClass: 'text-3xl', badgeClass: 'text-sm px-3 py-1' },
    xl: { iconW: 100, iconH: 100, textClass: 'text-5xl', badgeClass: 'text-base px-4 py-1' },
  };

  const { iconW, iconH, textClass, badgeClass } = dimensions[size] || dimensions.md;

  // Master Vector Icon SVG generated matching lFlogo.png
  const IconSvg = (
    <svg
      viewBox="0 0 500 350"
      width={iconW}
      height={iconH}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 select-none drop-shadow-sm"
    >
      <defs>
        {/* Bottle Liquid Gradient */}
        <linearGradient id="lf_v_bottle_liq" x1="240" y1="70" x2="310" y2="105" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF9D00" />
          <stop offset="100%" stopColor="#FF5500" />
        </linearGradient>

        {/* Drop Teardrop Gradient */}
        <linearGradient id="lf_v_drop" x1="228" y1="95" x2="228" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFC700" />
          <stop offset="100%" stopColor="#FF5500" />
        </linearGradient>

        {/* Cocktail Liquid Fill Gradient */}
        <linearGradient id="lf_v_glass_liq" x1="160" y1="110" x2="255" y2="185" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFBA00" />
          <stop offset="50%" stopColor="#FF6B00" />
          <stop offset="100%" stopColor="#D93800" />
        </linearGradient>

        {/* Chart Bars Gradients */}
        <linearGradient id="lf_v_bar1" x1="230" y1="180" x2="260" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#123B7A" />
          <stop offset="100%" stopColor="#0B234C" />
        </linearGradient>
        <linearGradient id="lf_v_bar2" x1="272" y1="140" x2="304" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0F2E63" />
          <stop offset="100%" stopColor="#0A1C3C" />
        </linearGradient>
        <linearGradient id="lf_v_bar3" x1="314" y1="100" x2="346" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0B2147" />
          <stop offset="100%" stopColor="#061228" />
        </linearGradient>

        {/* Wave Orange Gradient */}
        <linearGradient id="lf_v_wave_orange" x1="130" y1="190" x2="290" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF8C00" />
          <stop offset="100%" stopColor="#E64A00" />
        </linearGradient>

        {/* Wave Royal Blue Glossy 3D Gradient */}
        <linearGradient id="lf_v_wave_blue" x1="130" y1="210" x2="380" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#091838" />
          <stop offset="25%" stopColor="#004DA8" />
          <stop offset="65%" stopColor="#0077FF" />
          <stop offset="100%" stopColor="#0040A8" />
        </linearGradient>

        {/* Wave Gloss Highlight */}
        <linearGradient id="lf_v_wave_highlight" x1="220" y1="205" x2="370" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0077FF" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* 1. Bar Chart (3 Rising Columns on Right) */}
      <rect x="232" y="180" width="28" height="60" rx="3" fill="url(#lf_v_bar1)" />
      <rect x="272" y="140" width="28" height="100" rx="3" fill="url(#lf_v_bar2)" />
      <rect x="312" y="100" width="28" height="140" rx="3" fill="url(#lf_v_bar3)" />

      {/* 2. Angled Pouring Bottle */}
      <g id="lf_pouring_bottle">
        {/* Dark Outer Shell */}
        <path
          d="M234 84 L310 60 C316 58 322 62 323 68 L320 84 C319 89 314 93 308 95 L242 106 C236 107 230 103 229 97 L228 90 C227 86 230 84 234 84 Z"
          fill="#0B132B"
        />
        {/* Bottle Lip / Cap */}
        <path
          d="M234 84 L226 85 C222 86 220 89 220 93 L220 95 C220 99 222 102 226 103 L234 102 Z"
          fill="#080D1F"
        />
        {/* Inner Orange Liquid */}
        <path
          d="M250 78 L304 68 C308 67 312 70 312 74 L310 82 C309 85 306 87 302 88 L256 94 C252 95 248 92 247 88 L247 84 C246 80 248 78 250 78 Z"
          fill="url(#lf_v_bottle_liq)"
        />
      </g>

      {/* 3. Pouring Teardrop */}
      <path
        d="M228 102 C228 102 218 114 218 120 C218 126 222 130 228 130 C234 130 238 126 238 120 C238 114 228 102 228 102 Z"
        fill="url(#lf_v_drop)"
      />

      {/* 4. Cocktail / Martini Glass */}
      <g id="lf_martini_glass">
        {/* Glass Liquid Filling */}
        <path
          d="M166 128 L250 128 C248 138 222 182 210 182 C198 182 170 138 166 128 Z"
          fill="url(#lf_v_glass_liq)"
        />

        {/* Effervescent bubbles */}
        <circle cx="192" cy="150" r="4.5" fill="#FFE800" opacity="0.95" />
        <circle cx="204" cy="162" r="3.5" fill="#FFE800" opacity="0.9" />
        <circle cx="216" cy="144" r="5" fill="#FFE800" opacity="0.95" />

        {/* Top Rim Liquid Line */}
        <path
          d="M163 128 C168 124 248 124 253 128 C248 132 168 132 163 128 Z"
          fill="#FFE800"
        />

        {/* Dark Glass Frame Outer Structure */}
        <path
          d="M150 114 L204 192 L204 235 L182 240 C177 241 175 245 176 250 C177 255 182 258 188 258 L232 258 C238 258 243 255 244 250 C245 245 243 241 238 240 L216 235 L216 192 L270 114 C273 110 270 105 265 105 L155 105 C150 105 147 110 150 114 Z"
          fill="#0B132B"
        />
        {/* Inner Glass Translucent Overlay */}
        <path
          d="M160 115 L210 180 L260 115 Z"
          fill="#0B132B"
          opacity="0.12"
        />
      </g>

      {/* 5. Flowing Base Waves */}
      {/* Orange Upper Wave */}
      <path
        d="M120 220 C140 192 200 180 245 204 C280 222 315 212 355 195 C325 215 285 236 240 222 C195 208 150 210 120 220 Z"
        fill="url(#lf_v_wave_orange)"
      />

      {/* Dark Navy Middle Accent Wave */}
      <path
        d="M118 226 C165 208 220 225 260 232 C310 240 355 212 368 150 C372 195 340 238 280 242 C230 245 170 232 118 226 Z"
        fill="#081024"
      />

      {/* Royal Blue Glossy Lower Wave */}
      <path
        d="M122 232 C172 215 225 234 268 240 C322 248 370 218 382 148 C386 198 350 248 288 250 C232 252 172 238 122 232 Z"
        fill="url(#lf_v_wave_blue)"
      />

      {/* Blue Wave Sheen / Highlight */}
      <path
        d="M232 234 C278 242 335 228 372 172 C362 208 318 242 262 242 C250 242 240 238 232 234 Z"
        fill="url(#lf_v_wave_highlight)"
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

      <div className={orientation === 'vertical' ? 'mt-3 flex flex-col items-center' : 'flex flex-col'}>
        {/* Main "LiquorFlow" Brand Typography matching lFlogo.png */}
        <div className={`font-extrabold tracking-tight select-none flex items-baseline ${textClass}`}>
          <span className="text-[#FF6B00] bg-gradient-to-r from-[#FF7A00] via-[#FF6B00] to-[#E65100] bg-clip-text text-transparent">
            Liquor
          </span>
          <span className="text-[#0052CC] bg-gradient-to-r from-[#0066FF] via-[#0052CC] to-[#0033A0] bg-clip-text text-transparent">
            Flow
          </span>
        </div>

        {/* "ERP" Badge with Horizontal Whiskers matching lFlogo.png */}
        {showSubtitle && (
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="h-[1.5px] w-4 bg-gradient-to-r from-transparent via-slate-600 to-[#0A1633]" />
            <span
              className={`rounded-full bg-[#0C1838] text-white font-black tracking-[0.2em] uppercase shadow-md border border-slate-800 ${badgeClass}`}
            >
              ERP
            </span>
            <span className="h-[1.5px] w-4 bg-gradient-to-l from-transparent via-slate-600 to-[#0A1633]" />
          </div>
        )}
      </div>
    </div>
  );
};
