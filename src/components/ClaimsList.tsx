import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { Claim } from '@/types';

gsap.registerPlugin(useGSAP);

interface Props {
  claims: Claim[];
}

export function ClaimsList({ claims }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    gsap.from(containerRef.current.querySelectorAll('.claim-item'), {
      y: 20,
      opacity: 0,
      duration: 0.5,
      stagger: 0.1,
      ease: 'power2.out',
    });
  }, { scope: containerRef });

  if (claims.length === 0) {
    return null;
  }

  return (
    <Card ref={containerRef}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-2xl">📝</span>
          검증 가능 주장
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {claims.length}개
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {claims.map((claim, index) => (
          <div
            key={index}
            className="claim-item p-3 rounded-lg border-l-4 border-primary bg-muted/50"
          >
            <p className="text-sm leading-relaxed">{claim.text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
