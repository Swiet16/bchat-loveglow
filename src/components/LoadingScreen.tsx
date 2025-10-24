import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

export const LoadingScreen = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 360],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="inline-block mb-4"
        >
          <MessageCircle className="w-16 h-16 text-primary" />
        </motion.div>
        
        <h2 className="text-2xl font-bold gradient-text mb-2">
          Connecting to B-Chat...
        </h2>
        
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-muted-foreground"
        >
          Please wait
        </motion.div>
      </motion.div>
    </div>
  );
};
