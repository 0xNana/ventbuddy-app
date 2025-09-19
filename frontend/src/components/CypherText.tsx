import React, { useState, useEffect } from 'react';
import { useLogger } from '@/hooks/useLogger';

interface CypherTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export const CypherText: React.FC<CypherTextProps> = ({ 
  text, 
  speed = 50, 
  className = '', 
  onComplete 
}) => {
  const log = useLogger('CypherText');
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const cypherChars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,.<>?';

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        const randomChar = cypherChars[Math.floor(Math.random() * cypherChars.length)];
        setDisplayedText(prev => prev + randomChar);
        
        setTimeout(() => {
          setDisplayedText(prev => prev.slice(0, -1) + text[currentIndex]);
          setCurrentIndex(prev => prev + 1);
        }, speed / 2);
      }, speed);

      return () => clearTimeout(timer);
    } else if (!isComplete) {
      log.debug('CypherText completed', { text });
      setIsComplete(true);
      onComplete?.();
    }
  }, [currentIndex, text, speed, isComplete, onComplete]);

  const isFinalMessage = text.includes("System Ready") || text.includes("Welcome") || text.includes("Access granted");
  
  return (
    <span className={`font-mono text-green-400 ${className}`}>
      {isFinalMessage ? (
        <>
          <span className="text-green-500"></span> {displayedText}
        </>
      ) : (
        <>
          <span className="text-green-400/60">&gt;</span> {displayedText}
        </>
      )}
      {!isComplete && <span className="animate-pulse">|</span>}
    </span>
  );
};

interface CypherSequenceProps {
  messages: string[];
  onComplete?: () => void;
  className?: string;
}

export const CypherSequence: React.FC<CypherSequenceProps> = ({ 
  messages, 
  onComplete, 
  className = '' 
}) => {
  const log = useLogger('CypherSequence');
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isSequenceComplete, setIsSequenceComplete] = useState(false);

  const handleMessageComplete = () => {
    log.debug('Message completed', { messageIndex: currentMessageIndex + 1, totalMessages: messages.length });
    if (currentMessageIndex < messages.length - 1) {
      setTimeout(() => {
        setCurrentMessageIndex(prev => prev + 1);
      }, 1500);
    } else {
      log.info('All messages completed, calling onComplete', { totalMessages: messages.length });
      setIsSequenceComplete(true);
      setTimeout(() => {
        onComplete?.();
      }, 2000);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {messages.slice(0, currentMessageIndex + 1).map((message, index) => (
        <div key={index} className="min-h-[2rem]">
          {index === currentMessageIndex ? (
            <CypherText 
              text={message} 
              speed={50}
              onComplete={handleMessageComplete}
            />
          ) : (
            <span className="font-mono text-green-400">
              {message.includes("System Ready") || message.includes("Welcome") || message.includes("Access granted") ? (
                <>
                  <span className="text-green-500">✅</span> {message}
                </>
              ) : (
                <>
                  <span className="text-green-400/60">&gt;</span> {message}
                </>
              )}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
