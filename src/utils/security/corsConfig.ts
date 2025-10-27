import cors from "cors";

export const configureCors = () => {
  return cors({
    origin: [
      "http://localhost:5100", // local frontend
      "https://yourfrontenddomain.com", // production domain
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // if you send cookies or auth headers
  });
};
