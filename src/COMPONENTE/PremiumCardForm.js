import React, { useState, useRef, useEffect, useMemo } from 'react';
import './PremiumCardForm.css';

const PremiumCardForm = ({ onCardChange }) => {
    const [cardNumber, setCardNumber] = useState('');
    const [cardName, setCardName] = useState('');
    const [cardMonth, setCardMonth] = useState('');
    const [cardYear, setCardYear] = useState('');
    const [cardCvv, setCardCvv] = useState('');
    const [isCardFlipped, setIsCardFlipped] = useState(false);
    const [focusElementStyle, setFocusElementStyle] = useState(null);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [currentCardBackground] = useState(Math.floor(Math.random() * 25 + 1));

    const cardElements = {
        cardNumber: useRef(null),
        cardName: useRef(null),
        cardDate: useRef(null),
    };

    const minCardYear = new Date().getFullYear();
    const amexCardMask = "#### ###### #####";
    const otherCardMask = "#### #### #### ####";

    useEffect(() => {
        onCardChange?.({
            cardNumber: cardNumber,
            cardName: cardName,
            cardMonth: cardMonth,
            cardYear: cardYear,
            cardCvv: cardCvv
        });
    }, [cardNumber, cardName, cardMonth, cardYear, cardCvv]);

    const getCardType = useMemo(() => {
        let number = cardNumber;
        if (/^4/.test(number)) return "visa";
        if (/^(34|37)/.test(number)) return "amex";
        if (/^5[1-5]/.test(number)) return "mastercard";
        if (/^6011/.test(number)) return "discover";
        if (/^9792/.test(number)) return "troy";
        return "visa"; // default
    }, [cardNumber]);

    const generateCardNumberMask = getCardType === "amex" ? amexCardMask : otherCardMask;

    const minCardMonth = useMemo(() => {
        if (parseInt(cardYear) === minCardYear) return new Date().getMonth() + 1;
        return 1;
    }, [cardYear, minCardYear]);

    const focusInput = (e) => {
        setIsInputFocused(true);
        const targetRef = e.target.dataset.ref;
        const target = cardElements[targetRef]?.current;
        if (target) {
            setFocusElementStyle({
                width: `${target.offsetWidth}px`,
                height: `${target.offsetHeight}px`,
                transform: `translateX(${target.offsetLeft}px) translateY(${target.offsetTop}px)`
            });
        }
    };

    const blurInput = () => {
        setTimeout(() => {
            if (!isInputFocused) {
                setFocusElementStyle(null);
            }
        }, 300);
        setIsInputFocused(false);
    };

    const formatCardNumber = (value) => {
        let v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        let matches = v.match(/\d{4,16}/g);
        let match = (matches && matches[0]) || '';
        let parts = [];

        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }

        if (parts.length) {
            return parts.join(' ');
        } else {
            return value;
        }
    };

    const handleCardNumberChange = (e) => {
        setCardNumber(formatCardNumber(e.target.value));
    };

    return (
        <div className="card-form-container">
            <div className="card-list">
                <div className={`card-item ${isCardFlipped ? '-active' : ''}`}>
                    <div className="card-item__side -front">
                        <div className={`card-item__focus ${focusElementStyle ? '-active' : ''}`} style={focusElementStyle}></div>
                        <div className="card-item__cover">
                            <img src={`https://raw.githubusercontent.com/muhammederdem/credit-card-form/master/src/assets/images/${currentCardBackground}.jpeg`} className="card-item__bg" alt="bg" />
                        </div>
                        <div className="card-item__wrapper">
                            <div className="card-item__top">
                                <img src="https://raw.githubusercontent.com/muhammederdem/credit-card-form/master/src/assets/images/chip.png" className="card-item__chip" alt="chip" />
                                <div className="card-item__type">
                                    <img src={`https://raw.githubusercontent.com/muhammederdem/credit-card-form/master/src/assets/images/${getCardType}.png`} className="card-item__typeImg" alt="type" />
                                </div>
                            </div>
                            <label className="card-item__number" ref={cardElements.cardNumber}>
                                {generateCardNumberMask.split('').map((char, index) => {
                                    let displayChar = char;
                                    const isDigit = index < cardNumber.length;
                                    if (isDigit) {
                                        displayChar = cardNumber[index];
                                    }
                                    
                                    // Mask digits between index 4 and 15 (except amex)
                                    const shouldMask = getCardType === 'amex' 
                                        ? (index > 4 && index < 14) 
                                        : (index > 4 && index < 15);
                                    
                                    const isSpace = char === ' ';

                                    return (
                                        <div key={index} className={`card-item__numberItem ${isSpace ? '-active' : ''}`}>
                                            {isDigit && shouldMask && char !== ' ' ? '*' : (isDigit ? displayChar : char)}
                                        </div>
                                    );
                                })}
                            </label>
                            <div className="card-item__content">
                                <label className="card-item__info" ref={cardElements.cardName}>
                                    <div className="card-item__holder">Titular</div>
                                    <div className="card-item__name">
                                        {cardName.length ? cardName : "NOMBRE COMPLETO"}
                                    </div>
                                </label>
                                <div className="card-item__date" ref={cardElements.cardDate}>
                                    <label className="card-item__dateTitle">Vence</label>
                                    <label className="card-item__dateItem"><span>{cardMonth || 'MM'}</span></label>
                                    /
                                    <label className="card-item__dateItem"><span>{cardYear ? cardYear.toString().slice(2, 4) : 'YY'}</span></label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="card-item__side -back">
                        <div className="card-item__cover">
                            <img src={`https://raw.githubusercontent.com/muhammederdem/credit-card-form/master/src/assets/images/${currentCardBackground}.jpeg`} className="card-item__bg" alt="bg" />
                        </div>
                        <div className="card-item__band"></div>
                        <div className="card-item__cvv">
                            <div className="card-item__cvvTitle">CVV</div>
                            <div className="card-item__cvvBand">
                                {cardCvv.split('').map((n, i) => <span key={i}>*</span>)}
                            </div>
                            <div className="card-item__type">
                                <img src={`https://raw.githubusercontent.com/muhammederdem/credit-card-form/master/src/assets/images/${getCardType}.png`} className="card-item__typeImg" alt="type" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card-form__inner">
                <div className="card-input">
                    <label className="card-input__label">Número de Tarjeta</label>
                    <input 
                        type="text" 
                        className="card-input__input" 
                        value={cardNumber} 
                        onChange={handleCardNumberChange}
                        onFocus={focusInput}
                        onBlur={blurInput}
                        data-ref="cardNumber"
                        autoComplete="off"
                        maxLength="19"
                    />
                </div>
                <div className="card-input">
                    <label className="card-input__label">Nombre en la Tarjeta</label>
                    <input 
                        type="text" 
                        className="card-input__input" 
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        onFocus={focusInput}
                        onBlur={blurInput}
                        data-ref="cardName"
                        autoComplete="off"
                    />
                </div>
                <div className="card-form__row">
                    <div className="card-form__col">
                        <div className="card-form__group">
                            <label className="card-input__label">Fecha de Expiración</label>
                            <select 
                                className="card-input__input -select" 
                                value={cardMonth}
                                onChange={(e) => setCardMonth(e.target.value)}
                                onFocus={focusInput}
                                onBlur={blurInput}
                                data-ref="cardDate"
                            >
                                <option value="" disabled>Mes</option>
                                {[...Array(12)].map((_, i) => (
                                    <option key={i+1} value={i+1 < 10 ? `0${i+1}` : i+1} disabled={i+1 < minCardMonth}>
                                        {i+1 < 10 ? `0${i+1}` : i+1}
                                    </option>
                                ))}
                            </select>
                            <select 
                                className="card-input__input -select" 
                                value={cardYear}
                                onChange={(e) => setCardYear(e.target.value)}
                                onFocus={focusInput}
                                onBlur={blurInput}
                                data-ref="cardDate"
                            >
                                <option value="" disabled>Año</option>
                                {[...Array(12)].map((_, i) => (
                                    <option key={i} value={minCardYear + i}>
                                        {minCardYear + i}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="card-form__col -cvv">
                        <div className="card-input">
                            <label className="card-input__label">CVV</label>
                            <input 
                                type="text" 
                                className="card-input__input" 
                                maxLength="4"
                                value={cardCvv}
                                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                                onFocus={() => setIsCardFlipped(true)}
                                onBlur={() => setIsCardFlipped(false)}
                                autoComplete="off"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PremiumCardForm;
