import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export const TopLoadingBar: React.FC = () => {
  const location = useLocation();
  const [progress, setProgress] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    // On route change, briefly show a swift micro-progress animation
    setVisible(true);
    setProgress(30);

    const t1 = setTimeout(() => setProgress(75), 40);
    const t2 = setTimeout(() => setProgress(100), 120);
    const t3 = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 280);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-[2px] z-50 pointer-events-none overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500 shadow-sm shadow-cyan-500/50 transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
};
