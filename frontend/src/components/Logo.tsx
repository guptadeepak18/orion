import React from 'react';
import { clsx } from 'clsx';

interface LogoProps {
  variant?: 'full' | 'icon' | 'sidebar';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className,
  showText = false,
}) => {
  return (
    <div className={clsx('w-full flex flex-col items-center select-none', className)}>
      {/* Tight Full-Width Pure White Logo Container */}
      <div className="relative w-full rounded-2xl overflow-hidden shadow-sm transition-all duration-300 hover:scale-[1.01] bg-white p-2 border border-slate-200/80 dark:border-slate-800">
        {/* Light Mode Logo (Pure White Background & Tightly Cropped) */}
        <img
          src="/logo-light.jpg"
          alt="CRC One Logo"
          className="w-full h-auto max-h-36 object-contain block dark:hidden bg-white rounded-xl"
        />
        {/* Dark Mode Logo */}
        <img
          src="/logo-dark.jpg"
          alt="CRC One Logo"
          className="w-full h-auto max-h-36 object-contain hidden dark:block rounded-xl"
        />
      </div>

      {/* Typography (Only rendered if showText is explicitly true) */}
      {showText && (
        <div className="flex flex-col justify-center items-center mt-2">
          <span className="font-extrabold text-lg tracking-tight gradient-text">
            CRC One
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">
            Lexicon MILE
          </p>
        </div>
      )}
    </div>
  );
};
