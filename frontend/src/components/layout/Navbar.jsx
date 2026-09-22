import { Link } from "react-router-dom";

import { useState } from "react";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-border bg-background">
      <div className="container-lastdrip grid grid-cols-3 items-center h-16">
        <button
          className="justify-self-start md:hidden"
          onClick={() => setMenuOpen(true)}
        >
          {menuOpen && (
            <div className="fixed inset-0 bg-black/30">
              <button onClick={() => setMenuOpen(false)}>X</button>

              <nav className="flex flex-col fixed left-0 top-0 bottom-0 items-center gap-8">
                <Link to="/">Home</Link>
                <Link to="/products">Shop</Link>
                <Link to="/account">Account</Link>
              </nav>
            </div>
          )}
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
    </header>
  );
};

export default Navbar;
