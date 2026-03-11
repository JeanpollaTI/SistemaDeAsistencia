import React, { useEffect, useRef } from 'react';
import './DynamicBackground.css';

const DynamicBackground = () => {
    const canvasRef = useRef(null);
    const effectRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        const initEffect = async () => {
            try {
                // Importación dinámica del componente de Three.js
                const module = await import("https://cdn.jsdelivr.net/npm/threejs-components@0.0.19/build/cursors/tubes1.min.js");
                const TubesCursor = module.default;

                if (isMounted && canvasRef.current) {
                    effectRef.current = TubesCursor(canvasRef.current, {
                        tubes: {
                            colors: ["#00CBCB", "#007A7A", "#B8E2F2"],
                            lights: {
                                intensity: 200,
                                colors: ["#00CBCB", "#00B5B5", "#007A7A", "#60aed5"]
                            }
                        }
                    });

                    const handleRandomize = () => {
                        if (effectRef.current) {
                            const randomColorsArray = (count) => 
                                new Array(count).fill(0).map(() => 
                                    "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
                                );
                            
                            effectRef.current.tubes.setColors(randomColorsArray(3));
                            effectRef.current.tubes.setLightsColors(randomColorsArray(4));
                        }
                    };

                    document.body.addEventListener('click', handleRandomize);

                    return () => {
                        document.body.removeEventListener('click', handleRandomize);
                    };
                }
            } catch (error) {
                console.error("Error loading DynamicBackground effect:", error);
            }
        };

        initEffect();

        return () => {
            isMounted = false;
        };
    }, []);

    return <canvas id="canvas-dynamic" ref={canvasRef}></canvas>;
};

export default DynamicBackground;
