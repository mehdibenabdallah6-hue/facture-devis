import React from 'react';
import { motion } from 'motion/react';
import { Star } from 'lucide-react';

export interface Testimonial {
  text: string;
  name: string;
  role: string;
  image?: string;
  initials?: string;
}

interface TestimonialsColumnProps {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}

export const TestimonialsColumn: React.FC<TestimonialsColumnProps> = ({
  className,
  testimonials,
  duration = 10,
}) => {
  return (
    <div className={className}>
      <motion.div
        animate={{ translateY: '-50%' }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'linear',
          repeatType: 'loop',
        }}
        className="flex flex-col gap-6 pb-6"
      >
        {[...new Array(2).fill(0)].map((_, index) => (
          <React.Fragment key={index}>
            {testimonials.map(({ text, image, name, role, initials }, i) => (
              <div
                key={i}
                className="p-7 rounded-3xl border-spark bg-white shadow-spark-sm max-w-xs w-full"
              >
                <div className="flex gap-0.5 mb-3">
                  {[0, 1, 2, 3, 4].map(s => (
                    <Star key={s} className="w-3.5 h-3.5 text-primary fill-primary" />
                  ))}
                </div>
                <div className="text-[13px] text-on-surface-variant leading-relaxed italic">
                  “{text}”
                </div>
                <div className="flex items-center gap-2.5 mt-5">
                  {image ? (
                    <img
                      width={40}
                      height={40}
                      src={image}
                      alt={name}
                      loading="lazy"
                      className="h-10 w-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-headline font-extrabold text-xs">
                      {initials || name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <div className="font-bold tracking-tight leading-5 text-on-surface text-xs">
                      {name}
                    </div>
                    <div className="leading-5 text-on-surface-variant text-[10px]">
                      {role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};
