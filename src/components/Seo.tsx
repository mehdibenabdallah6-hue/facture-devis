import { useEffect } from 'react';

const DEFAULT_SITE_URL = 'https://photofacto.fr';
const DEFAULT_IMAGE_URL = `${DEFAULT_SITE_URL}/og-image.png`;

interface SeoProps {
  title: string;
  description: string;
  path: string;
  image?: string;
}

export function Seo({ title, description, path, image = DEFAULT_IMAGE_URL }: SeoProps) {
  useEffect(() => {
    const canonicalUrl = `${DEFAULT_SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', image);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
    setCanonical(canonicalUrl);
  }, [description, image, path, title]);

  return null;
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let meta = document.querySelector(`meta[${attribute}="${key}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function setCanonical(href: string) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}
