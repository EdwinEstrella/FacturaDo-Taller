"use client"

import React, { useRef, useEffect, useState } from "react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

// Helper function to merge class names
const cn = (...classes: string[]) => {
    return classes.filter(Boolean).join(" ");
};

// Custom Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: "default" | "outline";
    className?: string;
}

const Button = ({
    children,
    variant = "default",
    className = "",
    ...props
}: ButtonProps) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variantStyles = {
        default: "bg-primary bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
    };

    return (
        <button
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

// Custom Input Component
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    className?: string;
}

const Input = ({ className = "", ...props }: InputProps) => {
    return (
        <input
            className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm text-gray-800 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
            {...props}
        />
    );
};

// Custom Select Component
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    className?: string;
}

// Local Select removed as it was unused and shadowed import

type RoutePoint = {
    x: number;
    y: number;
    delay: number;
};

const DotMap = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Set up routes that will animate across the map
    const routes: { start: RoutePoint; end: RoutePoint; color: string }[] = [
        {
            start: { x: 100, y: 150, delay: 0 },
            end: { x: 200, y: 80, delay: 2 },
            color: "#2563eb",
        },
        {
            start: { x: 200, y: 80, delay: 2 },
            end: { x: 260, y: 120, delay: 4 },
            color: "#2563eb",
        },
        {
            start: { x: 50, y: 50, delay: 1 },
            end: { x: 150, y: 180, delay: 3 },
            color: "#2563eb",
        },
        {
            start: { x: 280, y: 60, delay: 0.5 },
            end: { x: 180, y: 180, delay: 2.5 },
            color: "#2563eb",
        },
    ];

    const generateDots = (width: number, height: number) => {
        const dots = [];
        const gap = 12;
        const dotRadius = 1;

        for (let x = 0; x < width; x += gap) {
            for (let y = 0; y < height; y += gap) {
                // Approximate map shape logic
                const isInMapShape =
                    ((x < width * 0.25 && x > width * 0.05) && (y < height * 0.4 && y > height * 0.1)) ||
                    ((x < width * 0.25 && x > width * 0.15) && (y < height * 0.8 && y > height * 0.4)) ||
                    ((x < width * 0.45 && x > width * 0.3) && (y < height * 0.35 && y > height * 0.15)) ||
                    ((x < width * 0.5 && x > width * 0.35) && (y < height * 0.65 && y > height * 0.35)) ||
                    ((x < width * 0.7 && x > width * 0.45) && (y < height * 0.5 && y > height * 0.1)) ||
                    ((x < width * 0.8 && x > width * 0.65) && (y < height * 0.8 && y > height * 0.6));

                if (isInMapShape && Math.random() > 0.3) {
                    dots.push({
                        x,
                        y,
                        radius: dotRadius,
                        opacity: Math.random() * 0.5 + 0.2,
                    });
                }
            }
        }
        return dots;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                setDimensions({ width, height });
                canvas.width = width;
                canvas.height = height;
            }
        });

        if (canvas.parentElement) {
            resizeObserver.observe(canvas.parentElement);
        }
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (!dimensions.width || !dimensions.height) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dots = generateDots(dimensions.width, dimensions.height);
        let animationFrameId: number;
        let startTime = Date.now();

        function drawDots() {
            ctx!.clearRect(0, 0, dimensions.width, dimensions.height);
            dots.forEach(dot => {
                ctx!.beginPath();
                ctx!.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
                ctx!.fillStyle = `rgba(37, 99, 235, ${dot.opacity})`;
                ctx!.fill();
            });
        }

        function drawRoutes() {
            const currentTime = (Date.now() - startTime) / 1000;

            routes.forEach(route => {
                const elapsed = currentTime - route.start.delay;
                if (elapsed <= 0) return;

                const duration = 3;
                const progress = Math.min(elapsed / duration, 1);

                const x = route.start.x + (route.end.x - route.start.x) * progress;
                const y = route.start.y + (route.end.y - route.start.y) * progress;

                ctx!.beginPath();
                ctx!.moveTo(route.start.x, route.start.y);
                ctx!.lineTo(x, y);
                ctx!.strokeStyle = route.color;
                ctx!.lineWidth = 1.5;
                ctx!.stroke();

                ctx!.beginPath();
                ctx!.arc(route.start.x, route.start.y, 3, 0, Math.PI * 2);
                ctx!.fillStyle = route.color;
                ctx!.fill();

                ctx!.beginPath();
                ctx!.arc(x, y, 3, 0, Math.PI * 2);
                ctx!.fillStyle = "#3b82f6";
                ctx!.fill();

                ctx!.beginPath();
                ctx!.arc(x, y, 6, 0, Math.PI * 2);
                ctx!.fillStyle = "rgba(59, 130, 246, 0.4)";
                ctx!.fill();

                if (progress === 1) {
                    ctx!.beginPath();
                    ctx!.arc(route.end.x, route.end.y, 3, 0, Math.PI * 2);
                    ctx!.fillStyle = route.color;
                    ctx!.fill();
                }
            });
        }

        function animate() {
            drawDots();
            drawRoutes();

            const currentTime = (Date.now() - startTime) / 1000;
            if (currentTime > 15) {
                startTime = Date.now();
            }

            animationFrameId = requestAnimationFrame(animate);
        }

        animate();

        return () => cancelAnimationFrame(animationFrameId);
    }, [dimensions]);

    return (
        <div className="relative w-full h-full overflow-hidden">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        </div>
    );
};

const SignInCard = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            // Import dynamic to avoid build issues if mixed component
            const { login } = await import("@/actions/auth-actions");
            const result = await login(username, password);

            if (result.success) {
                router.push('/');
            } else {
                setError(result.error || "Error al iniciar sesión");
            }
        } catch {
            setError("Ocurrió un error inesperado.");
        }
    };

    return (
        <div className="flex w-full h-full items-center justify-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-4xl overflow-hidden rounded-2xl flex bg-white shadow-xl min-h-[500px]"
            >
                {/* Left side - Map */}
                <div className="hidden md:block w-1/2 relative overflow-hidden border-r border-gray-100 bg-gradient-to-br from-blue-50 to-indigo-100">
                    <div className="absolute inset-0">
                        <DotMap />
                    </div>
                    {/* Logo and text overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6, duration: 0.5 }}
                            className="mb-6"
                        >
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                <ArrowRight className="text-white h-6 w-6" />
                            </div>
                        </motion.div>
                        <motion.h2
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7, duration: 0.5 }}
                            className="text-3xl font-bold mb-2 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600"
                        >
                            FacturaDO
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8, duration: 0.5 }}
                            className="text-sm text-center text-gray-600 max-w-xs"
                        >
                            Sistema de Facturación e Inventario Inteligente
                        </motion.p>
                    </div>
                </div>

                {/* Right side - Sign In Form */}
                <div className="w-full md:w-1/2 p-8 md:p-10 flex flex-col justify-center bg-white">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <h1 className="text-2xl md:text-3xl font-bold mb-1 text-gray-800">Bienvenido</h1>
                        <p className="text-gray-500 mb-8">Inicia sesión en tu cuenta</p>

                        <form className="space-y-5" onSubmit={handleLogin}>
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                                    Usuario <span className="text-blue-500">*</span>
                                </label>
                                <Input
                                    id="username"
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Usuario (ej. admin)"
                                    required
                                    className="bg-gray-50 border-gray-200 placeholder:text-gray-400 text-gray-800 w-full focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                    Contraseña <span className="text-blue-500">*</span>
                                </label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={isPasswordVisible ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Contraseña"
                                        required
                                        className="bg-gray-50 border-gray-200 placeholder:text-gray-400 text-gray-800 w-full pr-10 focus:border-blue-500 focus:ring-blue-500"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                                        onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                                    >
                                        {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <p className="text-red-500 text-sm mt-2">{error}</p>
                            )}

                            <motion.div
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                onHoverStart={() => setIsHovered(true)}
                                onHoverEnd={() => setIsHovered(false)}
                                className="pt-2"
                            >
                                <Button
                                    type="submit"
                                    className={cn(
                                        "w-full bg-gradient-to-r relative overflow-hidden from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white py-2 rounded-lg transition-all duration-300",
                                        isHovered ? "shadow-lg shadow-blue-200" : ""
                                    )}
                                >
                                    <span className="flex items-center justify-center">
                                        Ingresar
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </span>
                                    {isHovered && (
                                        <motion.span
                                            initial={{ left: "-100%" }}
                                            animate={{ left: "100%" }}
                                            transition={{ duration: 1, ease: "easeInOut" }}
                                            className="absolute top-0 bottom-0 left-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                            style={{ filter: "blur(8px)" }}
                                        />
                                    )}
                                </Button>
                            </motion.div>
                        </form>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
};

const LoginScreen = () => {
    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <SignInCard />
        </div>
    );
};

export default LoginScreen;
