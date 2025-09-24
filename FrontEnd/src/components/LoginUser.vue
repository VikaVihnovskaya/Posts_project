<template>
  <div class="login-user">
    <h2>Login</h2>

    <form @submit.prevent="loginUser">
      <div>
        <label for="login">Login:</label>
        <input
            id="login"
            v-model="login"
            type="text"
            placeholder="Enter login"
            required
        />
      </div>

      <div>
        <label for="password">Password:</label>
        <input
            id="password"
            v-model="password"
            type="password"
            placeholder="Enter password"
            required
        />
      </div>
      <button type="submit">Login</button>
    </form>

    <p v-if="message" :class="{ error: isError }">{{ message }}</p>
    <p class="nav-link">
      Don't have an account?
      <router-link to="/">Register</router-link>
    </p>
    <p class="nav-link">
      <a href="#">Forgot your password?</a> <!-- Пока не реализовано -->
    </p>
  </div>
</template>

<script setup>
import { ref } from "vue";
import router from "../router/index.js";

const login = ref("");
const password = ref("");
const message = ref("");
const isError = ref(false);

const loginUser = async () => {
  try {
    const res = await fetch("/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // обязательно для отправки/приёма cookie
      body: JSON.stringify({ login: login.value, password: password.value }),
    });

    let data = null;
    const contentType = res.headers.get("Content-Type") || "";

    if (contentType.includes("application/json")) {
      const text = await res.text();
      if (text) {
        data = JSON.parse(text);
      }
    }

    if (!res.ok) {
      throw new Error(data?.message || "Login failed");
    }

    message.value = "✅ Logged in successfully!";
    isError.value = false;
    login.value = "";
    password.value = "";
    router.push('/profile')
  } catch (err) {
    message.value = "❌ " + err.message;
    isError.value = true;
  }
};
</script>

<style scoped>
.login-user {
  max-width: 400px;
  margin: 1rem auto;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}
.login-user label {
  display: block;
  margin-bottom: 4px;
}
.login-user input {
  width: 100%;
  padding: 6px;
  margin-bottom: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
button {
  padding: 6px 12px;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background: #2a9d6f;
}
.error {
  color: red;
}
.nav-link {
  margin-top: 0.5rem;
  text-align: center;
}
</style>
