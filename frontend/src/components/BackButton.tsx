import React from 'react';
import { Button } from 'tdesign-react';
import { ChevronLeftIcon } from 'tdesign-icons-react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  to?: string;
  text?: string;
}

const BackButton: React.FC<BackButtonProps> = ({ to, text = '返回' }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <Button 
      variant="text" 
      icon={<ChevronLeftIcon />}
      onClick={handleBack}
      style={{ marginBottom: '16px' }}
    >
      {text}
    </Button>
  );
};

export default BackButton;