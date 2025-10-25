
import React from 'react';

interface CardProps {
    title: string;
    children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children }) => {
    return (
        <div className="bg-gray-800 rounded-lg shadow-lg p-6 w-full">
            <h2 className="text-xl font-bold text-cyan-400 mb-4 border-b border-gray-700 pb-2">{title}</h2>
            {children}
        </div>
    );
};

export default Card;
