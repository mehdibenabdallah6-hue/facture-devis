import React from 'react';

interface PhotofactoWordmarkProps {
  className?: string;
  /** Use on-dark variant (PHOTO becomes white instead of charcoal) */
  onDark?: boolean;
  /** Show tagline DOCUMENTER · VERIFIER · AVANCER */
  tagline?: boolean;
}

/**
 * Photofacto logotype — "PHOTO" en charbon + "FACTO" en orange,
 * police condensée chunky (Archivo Black), ligne typographique du logo.
 */
const PhotofactoWordmark: React.FC<PhotofactoWordmarkProps> = ({
  className = '',
  onDark = false,
  tagline = false,
}) => {
  return (
    <span className={`inline-flex flex-col items-center ${className}`}>
      <span className={`wordmark-photofacto ${onDark ? 'on-dark' : ''}`}>
        <span className="wm-photo">PHOTO</span>
        <span className="wm-facto">FACTO</span>
      </span>
      {tagline && (
        <span className="mt-1.5 flex items-center gap-2 text-[0.55em] tracking-[0.18em] uppercase font-semibold">
          <span className="h-px w-4 bg-spark-orange" />
          <span className={onDark ? 'text-white/80' : 'text-on-surface-variant'}>
            Documenter<span className="text-spark-orange">.</span>{' '}
            Verifier<span className="text-spark-orange">.</span>{' '}
            Avancer<span className="text-spark-orange">.</span>
          </span>
          <span className="h-px w-4 bg-spark-orange" />
        </span>
      )}
    </span>
  );
};

export default PhotofactoWordmark;
