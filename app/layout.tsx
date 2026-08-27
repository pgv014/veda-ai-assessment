import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VedaAI — Assessment Review',
  description: 'AI assessment extraction, answer mapping and grading.'
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
