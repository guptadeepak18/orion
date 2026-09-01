import React from 'react';
import { clsx } from 'clsx';

interface LogoProps {
  variant?: 'full' | 'icon' | 'sidebar';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showText?: boolean;
  collapsed?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className,
  showText = false,
  collapsed = false,
  variant,
}) => {
  const isIconOnly = collapsed || variant === 'icon';

  if (isIconOnly) {
    return (
      <div className={clsx('flex items-center justify-center select-none py-1', className)}>
        <div className="relative flex items-center justify-center h-10 w-10">
          <img
            src="/logo-icon.png"
            alt="Lexicon MILE"
            className="h-9 w-9 object-contain transition-transform duration-200 hover:scale-110 drop-shadow-sm"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('w-full flex flex-col items-center justify-center select-none', className)}>
      {/* Full-width High-Resolution Logo Container filling the Sidebar header */}
      <div className="relative w-full flex items-center justify-center px-1">
        {/* Light Mode High-Res Logo */}
        <img
          src="/logo-light.png"
          alt="Lexicon MILE Logo"
          className="w-full h-auto object-contain block dark:hidden transition-transform duration-200 hover:scale-[1.01]"
        />
        {/* Dark Mode High-Res Logo */}
        <img
          src="/logo-dark.png"
          alt="Lexicon MILE Logo"
          className="w-full h-auto object-contain hidden dark:block transition-transform duration-200 hover:scale-[1.01]"
        />
      </div>

      {/* Typography (Only rendered if showText is explicitly true) */}
      {showText && (
        <div className="flex flex-col justify-center items-center mt-1">
          <span className="font-extrabold text-sm tracking-tight gradient-text">
            Lexicon MILE
          </span>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide">
            Academic Operations
          </p>
        </div>
      )}
    </div>
  );
};
