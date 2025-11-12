import cors from "cors";

export const configureCors = () => {
  return cors({
    origin: [
      "http://localhost:5173",
      "https://easystore01.netlify.app",
      "http://localhost:5300",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });
};
