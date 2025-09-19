<template>
  <div class="register-user">
    <h2>Register user </h2>

    <form @submit.prevent="registerUser">
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

      <button type="submit">Register</button>
    </form>

    <p v-if="message" :class="{ error: isError }">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref } from "vue";

const login = ref("");
const password = ref("");
const message = ref("");
const isError = ref(false);

const registerUser = async () => {
  try {
    const res = await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: login.value, password: password.value }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Registration failed");
    }

    message.value = "✅ User registered successfully!";
    isError.value = false;
    login.value = "";
    password.value = "";
  } catch (err) {
    message.value = "❌ " + err.message;
    isError.value = true;
  }
};
</script>

<style scoped>
.register-user {
  max-width: 400px;
  margin: 1rem auto;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}
.register-user label {
  display: block;
  margin-bottom: 4px;
}
.register-user input {
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
</style>