import React from 'react';
import './DynamicBackground.css';

const DynamicBackground = () => {
    return (
        <div className="css-dynamic-background" aria-hidden="true">
            {/* Soft Ambient Cyan/Blue Light Orbs */}
            <div className="bg-glow-orb orb-1"></div>
            <div className="bg-glow-orb orb-2"></div>
            <div className="bg-glow-orb orb-3"></div>
        </div>
    );
};

export default DynamicBackground;
