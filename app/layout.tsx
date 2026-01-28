import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AiChatbot from './components/AiChatbot' // Import komponen baru

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FinCore AI - SaaS Accounting',
  description: 'Powered by Contech Labs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        
        {/* Pasang Chatbot di sini agar muncul di semua halaman */}
        <AiChatbot />
        
      </body>
    </html>
  )
}