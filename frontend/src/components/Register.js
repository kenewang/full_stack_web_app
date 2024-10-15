import React, { useState } from "react";
import { useEffect } from 'react'; // Import useEffect
import { useNavigate } from "react-router-dom";

function Register({ setAuth }) {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Share2Teach"; // Set the tab name to "Share2Teach"
  }, []); // This ensures the title is set when the component mounts

  const [inputs, setInputs] = useState({
    email: "",
    password: "",
    Fname: "",
    Lname: "",
    username: ""
  });

  const { email, password, Fname, Lname, username } = inputs;

  const onChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const onSubmitForm = async (e) => {
    e.preventDefault();
    console.log("Form submitted");

    try {
      const body = { email, password, Fname, Lname, username };

      const response = await fetch("http://localhost:3000/register", {
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
        alert(parseRes.msg || "Registration failed");
      }
    } catch (err) {
      console.error(err.message);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <form
        onSubmit={onSubmitForm}
        style={{
          display: "flex",
          flexDirection: "column",
          width: "300px",
          padding: "20px",
          border: "1px solid #ccc",
          borderRadius: "10px",
          boxShadow: "0px 0px 10px rgba(0, 0, 0, 0.1)"
        }}
      >
        <h1 style={{ textAlign: "center" }}>Register</h1>
        <input
          type="text"
          name="Fname"
          placeholder="First Name"
          value={Fname}
          onChange={onChange}
          style={{
            padding: "10px",
            margin: "10px 0",
            borderRadius: "5px",
            border: "1px solid #ccc"
          }}
        />
        <input
          type="text"
          name="Lname"
          placeholder="Last Name"
          value={Lname}
          onChange={onChange}
          style={{
            padding: "10px",
            margin: "10px 0",
            borderRadius: "5px",
            border: "1px solid #ccc"
          }}
        />
        <input
          type="text"
          name="username"
          placeholder="Username"
          value={username}
          onChange={onChange}
          style={{
            padding: "10px",
            margin: "10px 0",
            borderRadius: "5px",
            border: "1px solid #ccc"
          }}
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={email}
          onChange={onChange}
          style={{
            padding: "10px",
            margin: "10px 0",
            borderRadius: "5px",
            border: "1px solid #ccc"
          }}
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={password}
          onChange={onChange}
          style={{
            padding: "10px",
            margin: "10px 0",
            borderRadius: "5px",
            border: "1px solid #ccc"
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px",
            margin: "10px 0",
            borderRadius: "5px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            cursor: "pointer"
          }}
        >
          Register
        </button>
      </form>
    </div>
  );
}

export default Register;
