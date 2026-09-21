import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <header className="border-b border-border bg-background">
      <div className="container-lastdrip flex items-center justify-between h-16">
        <button className="flex size-10 items-center justify-center md:hidden">
          Menu
        </button>
        <Link to="/" className="font-display text-3xl">
          LASTDRIP
        </Link>
        <Link to="/cart" className="flex size-10 items-center justify-center">
          Cart
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link to="/">Home</Link>
          <Link to="/products">Shop</Link>
          <Link to="/account">Account</Link>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
