import { Link } from "react-router-dom";

import { useState, useEffect } from "react";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className="border-b border-border bg-background">
      <div className="container-lastdrip grid grid-cols-3 items-center h-16">
        <button
          className="justify-self-start md:hidden"
          onClick={() => setMenuOpen(true)}
        >
          Menu
        </button>
        <Link
          to="/"
          className="justify-self-center md:justify-self-start font-display text-3xl"
        >
          LASTDRIP
        </Link>

        <nav className="hidden md:flex items-center gap-8 justify-self-center">
          <Link to="/">Home</Link>
          <Link to="/products">Shop</Link>
          <Link to="/account">Account</Link>
        </nav>

        <Link to="/cart" className="size-10 justify-self-end">
          Cart
        </Link>
      </div>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setMenuOpen(false)}
          />

          <aside className="flex flex-col fixed inset-y-0 left-0 z-50 w-[80%] bg-background md:hidden p-6">
            <div className="flex items-center justify-between">
              <button
                className="flex size-10 items-center justify-center"
                type="button"
                onClick={() => setMenuOpen(false)}
              >
                X
              </button>

              <Link
                to="/"
                className="font-display text-3xl"
              >
                LASTDRIP
              </Link>
            </div>

            <nav className="flex flex-col items-start gap-8 mt-10">
              <Link to="/" onClick={() => setMenuOpen(false)}>
                Home
              </Link>

              <Link to="/products" onClick={() => setMenuOpen(false)}>
                Shop
              </Link>

              <Link to="/account" onClick={() => setMenuOpen(false)}>
                Account
              </Link>
            </nav>
          </aside>
        </>
      )}
    </header>
  );
};

export default Navbar;
