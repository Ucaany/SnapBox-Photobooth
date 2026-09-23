import type { Metadata } from 'next';

import FoundationsGallery from './foundations-gallery';

export const metadata: Metadata = {
  title: 'Design System Foundations',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <FoundationsGallery />;
}
