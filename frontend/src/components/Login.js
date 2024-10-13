import React, { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css"; // Import the CSS file

function Login({ setAuth }) {
  const navigate = useNavigate();

  const [inputs, setInputs] = useState({
    email: "",
    password: ""
  });

  const { email, password } = inputs;
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState("");

  const onChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const onSubmitForm = async (e) => {
    e.preventDefault();
    try {
      const body = { email, password };

      const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const parseRes = await response.json();

      if (parseRes.jwtToken) {
        localStorage.setItem("token", parseRes.jwtToken);
        setAuth(true);
        navigate("/");
      } else {
        alert(parseRes.msg || "Login failed");
      }
    } catch (err) {
      console.error(err.message);
    }
  };

  const handleForgotPassword = async () => {
    try {
      const response = await fetch("http://localhost:3000/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const parseRes = await response.json();
      setForgotPasswordMessage(parseRes.msg || "Password reset link sent to your email!");
    } catch (err) {
      console.error(err.message);
      setForgotPasswordMessage("Error sending password reset link.");
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={onSubmitForm}>
        <h1>Login</h1>
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={email}
          onChange={(e) => onChange(e)}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={password}
          onChange={(e) => onChange(e)}
          required
        />
        <div className="forgot-password-container">
          <p onClick={handleForgotPassword}>Forgot Password?</p>
        </div>

        {forgotPasswordMessage && <p className="forgot-password-message">{forgotPasswordMessage}</p>}

        <button type="submit">Login</button>
      </form>
    </div>
  );
}

export default Login;
