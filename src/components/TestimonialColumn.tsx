import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star } from 'lucide-react';

export interface Testimonial {
  quote: string;
  name: string;
  /** Profession + ville, ex: "Plombier · Marseille" */
  role: string;
  /** Portrait URL displayed in the animated case-study card. */
  image: string;
}

interface TestimonialColumnProps {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}

export const TestimonialColumn: React.FC<TestimonialColumnProps> = ({
  className,
  testimonials,
  duration = 18,
}) => {
  // Pause the auto-scroll when the user is reading a card.
  const [paused, setPaused] = useState(false);

  return (
    <div
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <motion.div
        animate={paused ? undefined : { translateY: '-50%' }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'linear',
          repeatType: 'loop',
        }}
        className="flex flex-col gap-5 pb-5"
      >
        {[...new Array(2).fill(0)].map((_, loop) => (
          <React.Fragment key={loop}>
            {testimonials.map(({ quote, name, role, image }, i) => (
              <article
                key={i}
                className="p-6 md:p-7 rounded-3xl border-spark bg-white shadow-spark-sm max-w-xs w-full transition-all duration-200 ease-out hover:shadow-spark-md hover:-translate-y-0.5 hover:border-primary/30"
              >
                <div className="flex gap-0.5 mb-3" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map(s => (
                    <Star key={s} className="w-3.5 h-3.5 text-primary fill-primary" />
                  ))}
                </div>
                <p className="text-[14px] md:text-[15px] text-on-surface leading-[1.55]">
                  {quote}
                </p>
                <div className="mt-5 pt-4 border-t border-on-surface-variant/10 flex items-center gap-3">
                  <img
                    src={image}
                    alt={name}
                    width={40}
                    height={40}
                    loading="lazy"
                    className="h-10 w-10 rounded-full object-cover shrink-0 ring-1 ring-on-surface-variant/15"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-[13px] text-on-surface leading-tight truncate">
                      {name}
                    </div>
                    <div className="text-[11px] text-on-surface-variant leading-tight mt-0.5 truncate">
                      {role}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  );
};
