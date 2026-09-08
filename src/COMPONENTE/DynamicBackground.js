import React from 'react';
import './DynamicBackground.css';
import logo from '../logo.png';

const DynamicBackground = () => {
    return (
        <div className="css-dynamic-background" aria-hidden="true">
            {/* Ambient Cyan/Blue Light Orbs */}
            <div className="bg-glow-orb orb-1"></div>
            <div className="bg-glow-orb orb-2"></div>
            <div className="bg-glow-orb orb-3"></div>

            {/* Subtle Cyber Tech Grid */}
            <div className="bg-tech-grid"></div>

            {/* Central Animated Glowing Logo (Infinity Loop) */}
            <div className="infinity-logo-wrapper">
                <div className="infinity-glow-ring ring-outer"></div>
                <div className="infinity-glow-ring ring-inner"></div>
                <img src={logo} alt="" className="infinity-logo-img" />
            </div>

            {/* Floating Particles */}
            <div className="cyber-particles">
                <span className="particle p1"></span>
                <span className="particle p2"></span>
                <span className="particle p3"></span>
                <span className="particle p4"></span>
                <span className="particle p5"></span>
                <span className="particle p6"></span>
            </div>
        </div>
    );
};

export default DynamicBackground;
