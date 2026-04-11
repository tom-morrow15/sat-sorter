import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to home when landing page loads
    navigate('/home', { replace: true });
  }, [navigate]);

  return null;
}
