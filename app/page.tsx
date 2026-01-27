'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function LandingPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // Efek Parallax: Background bergerak sedikit mengikuti mouse
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX - window.innerWidth / 2) / 50,
        y: (e.clientY - window.innerHeight / 2) / 50,
      })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div className="relative min-h-screen bg-[#050505] overflow-hidden font-sans text-white selection:bg-orange-500 selection:text-white">
      
      {/* === 1. ANIMATED BACKGROUND (THE LIVING CORE) === */}
      <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none">
        
        {/* Glow Effect di belakang logo */}
        <div className="absolute w-[500px] h-[500px] bg-orange-600/20 rounded-full blur-[120px] animate-pulse-slow"></div>
        
        {/* LOGO RAKSASA YANG BERNAFAS & BERPUTAR */}
        <div 
            className="relative w-[80vh] h-[80vh] opacity-20 transition-transform duration-100 ease-out"
            style={{ 
                transform: `translate(${mousePosition.x * -1}px, ${mousePosition.y * -1}px)` // Parallax effect
            }}
        >
            <img 
                src="/logo-contech.png" 
                alt="Contech Core" 
                className="w-full h-full object-contain animate-living-core"
            />
        </div>
      </div>

      {/* Grid Pattern Halus untuk Tekstur Tech */}
      <div className="fixed inset-0 z-0 opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      {/* === 2. NAVBAR (GLASS) === */}
      <nav className="fixed top-0 w-full z-50 px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <img src="/logo-contech.png" className="h-6 w-auto" alt="Logo" />
            <span className="font-bold tracking-widest text-sm uppercase text-gray-300">Contech <span className="text-orange-500">Labs</span></span>
        </div>

        <Link href="/auth" className="group relative px-6 py-2 rounded-full bg-white text-black font-bold text-sm hover:bg-orange-500 hover:text-white transition-all duration-300 overflow-hidden">
            <span className="relative z-10">Login System</span>
        </Link>
      </nav>

      {/* === 3. HERO CONTENT (CENTERED) === */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 text-center">
        
        {/* Badge Futuristik */}
        <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <span className="px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-mono tracking-[0.2em] uppercase shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                System Online • v.2.0
            </span>
        </div>

        {/* Headline Mewah */}
        <h1 className="max-w-5xl text-5xl md:text-8xl font-black tracking-tighter mb-6 leading-[0.9] animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500">
                FINANCIAL
            </span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 drop-shadow-2xl">
                INTELLIGENCE
            </span>
        </h1>

        <p className="max-w-2xl text-lg md:text-xl text-gray-400 mb-10 font-light leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            Bukan sekadar aplikasi akuntansi. Ini adalah <span className="text-white font-medium">saraf digital</span> untuk bisnis Anda. 
            Mengelola aset, kontrak, dan cashflow dengan presisi AI.
        </p>

        {/* Call to Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-5 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <Link href="/auth" className="relative group px-8 py-4 bg-orange-600 text-white font-bold rounded-lg overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(234,88,12,0.4)]">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <span className="relative flex items-center gap-2">
                    AKSES CONSOLE
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </span>
            </Link>

            <Link href="/auth" className="px-8 py-4 bg-transparent border border-white/20 text-white font-medium rounded-lg hover:bg-white/5 hover:border-white/40 transition-all backdrop-blur-sm">
                LIHAT DEMO
            </Link>
        </div>

        {/* Footer Kecil di Bawah */}
        <div className="absolute bottom-8 text-xs text-gray-600 font-mono tracking-widest uppercase animate-pulse">
            Secure Connection • Encrypted • Contech Labs
        </div>

      </main>

      {/* === CSS ANIMATIONS (CUSTOM) === */}
      <style jsx>{`
        @keyframes living-core {
            0% { transform: scale(1) rotate(0deg); filter: brightness(0.8); }
            50% { transform: scale(1.05) rotate(2deg); filter: brightness(1.2) drop-shadow(0 0 30px rgba(234,88,12,0.3)); }
            100% { transform: scale(1) rotate(0deg); filter: brightness(0.8); }
        }
        .animate-living-core {
            animation: living-core 8s ease-in-out infinite;
        }
        .animate-pulse-slow {
            animation: pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
            opacity: 0;
            animation: fadeInUp 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  )
}