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
            box: 'h-6 w-6 sm:h-7 sm:w-7 rounded-md sm:rounded-lg',
            icon: 'h-3 w-3 sm:h-3.5 sm:w-3.5',
            text: 'text-sm sm:text-base',
        },
        md: {
            box: 'h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl',
            icon: 'h-3.5 w-3.5 sm:h-5 sm:w-5',
            text: 'text-base sm:text-xl',
        },
        lg: {
            box: 'h-9 w-9 sm:h-11 sm:w-11 rounded-xl',
            icon: 'h-4.5 w-4.5 sm:h-6 sm:w-6',
            text: 'text-lg sm:text-2xl',
        },
    }[size];

    const isDark = theme === 'dark';

    const content = (
        <div className={`group inline-flex items-center gap-1.5 sm:gap-2.5 select-none transition-transform hover:scale-[1.02] active:scale-[0.98] ${className}`}>
            {/* Badge Violet avec Book en Blanc */}
            <div className={`flex items-center justify-center bg-[#6D28D9] text-white shadow-sm shadow-purple-500/20 group-hover:shadow-md group-hover:shadow-purple-500/30 transition-all shrink-0 ${sizeConfig.box}`}>
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
