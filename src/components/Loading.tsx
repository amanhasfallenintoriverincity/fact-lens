import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

gsap.registerPlugin(useGSAP);

export function Loading() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    gsap.to('.loading-spinner', {
      rotate: 360,
      duration: 1,
      repeat: -1,
      ease: 'linear',
    });

    gsap.from('.loading-text', {
      opacity: 0,
      y: 10,
      duration: 0.5,
      ease: 'power2.out',
    });
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center py-12">
      <Card className="w-full max-w-sm border-0 shadow-none">
        <CardContent className="flex flex-col items-center gap-4 pt-6">
          <div className="loading-spinner">
            <Loader2 className="w-12 h-12 text-primary" />
          </div>
          <p className="loading-text text-sm text-muted-foreground font-medium">
            기사를 분석하고 있습니다...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
