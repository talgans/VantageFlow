import React, { useEffect, useRef, useState } from 'react';
import TermsOfServiceModal from './TermsOfServiceModal';
import PrivacyPolicyModal from './PrivacyPolicyModal';

interface WelcomeScreenProps {
  onLogin: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number[];
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onLogin }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle configuration
    const particleCount = 80;
    const particles: Particle[] = [];
    const connectionDistance = 150;
    const particleSpeed = 0.3;

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * particleSpeed,
        vy: (Math.random() - 0.5) * particleSpeed,
        connections: [],
      });
    }

    // Animation loop
    const animate = () => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particles.forEach((particle, i) => {
        // Move particle
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Bounce off edges
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

        // Keep within bounds
        particle.x = Math.max(0, Math.min(canvas.width, particle.x));
        particle.y = Math.max(0, Math.min(canvas.height, particle.y));

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 211, 238, 0.8)';
        ctx.fill();

        // Draw connections
        particles.forEach((otherParticle, j) => {
          if (i >= j) return;

          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const opacity = (1 - distance / connectionDistance) * 0.5;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = `rgba(34, 211, 238, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 relative overflow-hidden">
      {/* Animated network background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a)' }}
      />

      {/* Header */}
      <header className="relative z-10 px-8 py-6">
        <h1 className="text-2xl font-bold text-white">VantageFlow</h1>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4">
        <div className="text-center mb-12">
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Welcome to VantageFlow
          </h2>
          <p className="text-xl md:text-2xl text-slate-300">
            Visualize Your Progress. Achieve Your Goals.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button
            onClick={onLogin}
            className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white text-lg font-semibold rounded-lg transition-colors shadow-lg shadow-blue-500/50"
          >
            Log In
          </button>
        </div>

        {/* Footer links */}
        <div className="flex gap-6 text-slate-400 text-sm">
          <button
            onClick={() => setIsTermsOpen(true)}
            className="hover:text-white transition-colors"
          >
            Terms of Service
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={() => setIsPrivacyOpen(true)}
            className="hover:text-white transition-colors"
          >
            Privacy Policy
          </button>
        </div>
      </div>

      {/* Bottom footer */}
      <footer className="relative z-10 px-8 py-6 flex justify-between items-center text-slate-500 text-sm">
        <div className="flex gap-6">
          <button
            onClick={() => setIsPrivacyOpen(true)}
            className="hover:text-white transition-colors"
          >
            Privacy
          </button>
          <button
            onClick={() => setIsTermsOpen(true)}
            className="hover:text-white transition-colors"
          >
            Terms
          </button>
        </div>
        <div>VantageFlow v1.0</div>
      </footer>

      {/* Modals */}
      <TermsOfServiceModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />
      <PrivacyPolicyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />
    </div>
  );
};

export default WelcomeScreen;

