/**
 * ConfigScreen.jsx
 * Setup inicial del usuario — delega toda la lógica a CreateAccountScreen.
 */
import CreateAccountScreen from "./CreateAccountScreen";

export default function ConfigScreen({ user, onDone }) {
  return (
    <CreateAccountScreen
      mode="setup"
      user={user}
      onDone={onDone}
    />
  );
}