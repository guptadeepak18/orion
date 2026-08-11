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
      {/* Seamless High-Resolution Full-Width Logo Container */}
      <div className="relative w-full flex items-center justify-center bg-transparent border-none shadow-none">
        {/* Light Mode High-Res Logo */}
        <img
          src="/logo-light.png"
          alt="Orion Logo"
          className="w-full h-auto object-contain block dark:hidden transition-transform duration-300 hover:scale-[1.01]"
        />
        {/* Dark Mode High-Res Logo */}
        <img
          src="/logo-dark.png"
          alt="Orion Logo"
          className="w-full h-auto object-contain hidden dark:block transition-transform duration-300 hover:scale-[1.01]"
        />
      </div>

      {/* Typography (Only rendered if showText is explicitly true) */}
      {showText && (
        <div className="flex flex-col justify-center items-center mt-2">
          <span className="font-extrabold text-lg tracking-tight gradient-text">
            Orion
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">
            Lexicon MILE
          </p>
        </div>
      )}
    </div>
  );
};
