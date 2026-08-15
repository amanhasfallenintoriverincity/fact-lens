import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

gsap.registerPlugin(useGSAP);

export function Header() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    gsap.from(containerRef.current.querySelectorAll('.animate-item'), {
      y: -20,
      opacity: 0,
      duration: 0.6,
      stagger: 0.1,
      ease: 'power3.out',
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground">
      <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)] pointer-events-none" />
      <CardHeader className="relative">
        <div className="flex items-center gap-3 animate-item">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
            <Sparkles className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Fact Lens</CardTitle>
        </div>
        <CardDescription className="text-primary-foreground/90 animate-item">
          AI 기반 뉴스 편향성 & 팩트체크 분석기
        </CardDescription>
      </CardHeader>
    </div>
  );
}
