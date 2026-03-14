import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    window.location.replace("/pwa/");
  }, []);

  return (
    <div
      style={{
        background: "#000",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ color: "#fff", fontFamily: "system-ui", fontSize: 16 }}>
        Loading Notes…
      </span>
    </div>
  );
}
