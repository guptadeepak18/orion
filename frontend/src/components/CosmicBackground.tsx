import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  maxAlpha: number;
  minAlpha: number;
  speed: number;
  twinkleDir: number;
  hue: number; // 0 = cyan/blue, 1 = indigo/purple
}

interface Comet {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  colorDark: string;
  colorLight: string;
  active: boolean;
}

export const CosmicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    };

    window.addEventListener('resize', handleResize);

    let stars: Star[] = [];

    const initStars = () => {
      stars = [];
      const count = Math.min(160, Math.max(80, Math.floor((width * height) / 9000)));
      for (let i = 0; i < count; i++) {
        const minA = Math.random() * 0.2 + 0.15;
        const maxA = Math.random() * 0.4 + 0.55;
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 1.8 + 0.6,
          alpha: Math.random() * (maxA - minA) + minA,
          maxAlpha: maxA,
          minAlpha: minA,
          speed: Math.random() * 0.0025 + 0.0008, // Very slow, calm, gentle twinkle
          twinkleDir: Math.random() > 0.5 ? 1 : -1,
          hue: Math.random() > 0.5 ? 0 : 1,
        });
      }
    };

    initStars();

    // Comets pool
    const comets: Comet[] = [];

    const spawnComet = () => {
      if (comets.length > 2) return;
      const startSide = Math.random() > 0.5 ? 'top' : 'right';
      const angle = (Math.PI / 4) + (Math.random() * 0.2 - 0.1); // ~45 degrees diagonal
      comets.push({
        x: startSide === 'top' ? Math.random() * width * 0.8 : width + 20,
        y: startSide === 'top' ? -20 : Math.random() * height * 0.5,
        length: Math.random() * 90 + 70,
        speed: Math.random() * 3 + 4.5,
        angle: angle,
        colorDark: Math.random() > 0.5 ? '#38bdf8' : '#818cf8',
        colorLight: Math.random() > 0.5 ? '#0284c7' : '#6366f1',
        active: true,
      });
    };

    // Spawn comets periodically with calm pacing
    const cometInterval = setInterval(() => {
      if (Math.random() > 0.25) {
        spawnComet();
      }
    }, 4500);

    const render = () => {
      const isDark = document.documentElement.classList.contains('dark');
      ctx.clearRect(0, 0, width, height);

      // Render stars
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.alpha += star.speed * star.twinkleDir;
        if (star.alpha >= star.maxAlpha) {
          star.alpha = star.maxAlpha;
          star.twinkleDir = -1;
        } else if (star.alpha <= star.minAlpha) {
          star.alpha = star.minAlpha;
          star.twinkleDir = 1;
        }

        if (isDark) {
          // Dark Mode Stars: crisp ice-white and luminous cyan
          const fill = star.hue === 0
            ? `rgba(224, 242, 254, ${star.alpha})`
            : `rgba(199, 210, 254, ${star.alpha})`;
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          ctx.fill();

          if (star.radius > 1.3 && star.alpha > 0.4) {
            ctx.fillStyle = `rgba(56, 189, 248, ${star.alpha * 0.25})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius * 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Light Mode Stars: deep sapphire indigo & cyan stardust with high contrast
          const fill = star.hue === 0
            ? `rgba(14, 116, 144, ${star.alpha * 0.75})` // deep cyan/teal
            : `rgba(67, 56, 202, ${star.alpha * 0.8})`;  // deep indigo
          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius * 1.1, 0, Math.PI * 2);
          ctx.fill();

          if (star.radius > 1.2 && star.alpha > 0.4) {
            ctx.fillStyle = `rgba(99, 102, 241, ${star.alpha * 0.25})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius * 2.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Constellation lines
      ctx.lineWidth = isDark ? 0.6 : 0.8;
      for (let i = 0; i < Math.min(stars.length, 35); i++) {
        for (let j = i + 1; j < Math.min(stars.length, 35); j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            const lineAlpha = (1 - dist / 100) * 0.15 * Math.min(stars[i].alpha, stars[j].alpha);
            ctx.strokeStyle = isDark
              ? `rgba(56, 189, 248, ${lineAlpha})`
              : `rgba(99, 102, 241, ${lineAlpha * 1.6})`;
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.stroke();
          }
        }
      }

      // Render comets
      for (let i = comets.length - 1; i >= 0; i--) {
        const comet = comets[i];
        if (!comet.active) continue;

        const tailX = comet.x - Math.cos(comet.angle) * comet.length;
        const tailY = comet.y - Math.sin(comet.angle) * comet.length;

        const color = isDark ? comet.colorDark : comet.colorLight;
        const gradient = ctx.createLinearGradient(comet.x, comet.y, tailX, tailY);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.3, color);
        gradient.addColorStop(1, 'transparent');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = isDark ? 1.8 : 2.2;
        ctx.beginPath();
        ctx.moveTo(comet.x, comet.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Comet head
        ctx.fillStyle = isDark ? '#ffffff' : color;
        ctx.beginPath();
        ctx.arc(comet.x, comet.y, isDark ? 1.8 : 2.2, 0, Math.PI * 2);
        ctx.fill();

        comet.x += Math.cos(comet.angle) * comet.speed;
        comet.y += Math.sin(comet.angle) * comet.speed;

        if (comet.x > width + 100 || comet.y > height + 100) {
          comet.active = false;
          comets.splice(i, 1);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(cometInterval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Background fill */}
      <div className="absolute inset-0 bg-[#f8fafc] dark:bg-[#060919] transition-colors duration-300" />
      
      {/* Soft Ambient Nebula Glows */}
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-cyan-500/10 dark:bg-cyan-500/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[550px] h-[550px] bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/4 w-[500px] h-[500px] bg-blue-600/10 dark:bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Dynamic Star & Comet Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-80 dark:opacity-95"
      />
    </div>
  );
};
