import { Route, Routes } from "react-router-dom";
import Navbar from "./components/navbar.component";
import UserAuthForm from "./pages/userAuthForm";
import { useEffect, useState } from "react";
import { lookInSession } from "./common/session";
import { createContext } from "react";
import Editor from "./pages/editorpage";
import HomePage from "./pages/homepage";
import SearchPage from "./pages/searchpage";
import PageNotFound from "./components/pagenotfound.component";
import ProfilePage from "./pages/profilepage";
import BlogPage from "./pages/blog.page";
import SideNav from "./components/sidenavbar.component";
import ChangePassword from "./pages/change.password.page";
import EditProfile from "./pages/edit.profile.page";

export const UserContext = createContext();
export const ThemeContext = createContext();

const darkThemePreference = window.matchMedia("(prefers-color-scheme: dark)").matches;

const App = () => {
  const [userAuth, setUserAuth] = useState({});
  const [theme, setTheme] = useState(darkThemePreference ? "dark" : "light");

  useEffect(() => {
    const userInSession = lookInSession("user");
    const themeInSession = lookInSession("theme");

    if (userInSession) {
      setUserAuth(JSON.parse(userInSession));
    } else {
      setUserAuth({ access_token: null });
    }

    if (themeInSession) {
      setTheme(themeInSession);
    }

    document.body.setAttribute("data-theme", themeInSession || theme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
    <UserContext.Provider value={{ userAuth, setUserAuth }}>
      <Routes>
        <Route path="/editor" element={<Editor />} />
        <Route path="/editor/:blog_id" element={<Editor />} />
        <Route path="/" element={<Navbar />}>
          <Route index element={<HomePage />}></Route>
          <Route path="settings" element={<SideNav />}>
              <Route path="edit-profile" element={<EditProfile />} />
              <Route path="change-password" element={<ChangePassword />} />
          </Route>
          <Route
            path="/signin"
            element={<UserAuthForm type="sign-in" />}
          ></Route>
          <Route
            path="/signup"
            element={<UserAuthForm type="sign-up" />}
          ></Route>
          <Route path="/search/:query" element={<SearchPage />}></Route>
          <Route path="/user/:id" element={<ProfilePage />}></Route>
          <Route path="/blog/:blog_id" element={<BlogPage />}></Route>
          <Route path="*" element={<PageNotFound />}></Route>
        </Route>
      </Routes>
    </UserContext.Provider>
    </ ThemeContext.Provider>
  );
};

export default App;
