'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

interface LogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    href?: string;
    theme?: 'light' | 'dark';
}

export default function Logo({ className = '', size = 'md', href = '/', theme = 'light' }: LogoProps) {
    const sizeConfig = {
        sm: {
            box: 'h-8 w-8 rounded-lg',
            icon: 'h-4 w-4',
            text: 'text-lg',
        },
        md: {
            box: 'h-9 w-9 rounded-xl',
            icon: 'h-5 w-5',
            text: 'text-xl',
        },
        lg: {
            box: 'h-11 w-11 rounded-xl',
            icon: 'h-6 w-6',
            text: 'text-2xl',
        },
    }[size];

    const isDark = theme === 'dark';

    const content = (
        <div className={`group inline-flex items-center gap-2.5 select-none transition-transform hover:scale-[1.02] active:scale-[0.98] ${className}`}>
            {/* Badge Violet avec Book en Blanc */}
            <div className={`flex items-center justify-center bg-[#6D28D9] text-white shadow-sm shadow-purple-500/20 group-hover:shadow-md group-hover:shadow-purple-500/30 transition-all ${sizeConfig.box}`}>
                <BookOpen className={`${sizeConfig.icon} transition-transform group-hover:scale-110`} strokeWidth={2.3} />
            </div>

            {/* Texte LivreZone avec coloration orange de "Livre" au survol / clic */}
            <span className={`font-black tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-900'} ${sizeConfig.text}`}>
                <span className={`${isDark ? 'text-white' : 'text-slate-900'} transition-colors duration-150 group-hover:text-[#F97316] group-active:text-[#F97316]`}>
                    Livre
                </span>
                <span className={isDark ? 'text-violet-400' : 'text-[#6D28D9]'}>Zone</span>
            </span>
        </div>
    );

    if (href) {
        return (
            <Link href={href} className="inline-flex items-center focus:outline-none">
                {content}
            </Link>
        );
    }

    return content;
}
