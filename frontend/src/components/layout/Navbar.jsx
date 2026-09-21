import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <header>
      <div>
        <button>Menu</button>
        <Link to="/">LASTDRIP</Link>
        <Link to="/cart">Cart</Link>

        <nav>
          <Link to="/">Home</Link>
          <Link to="/products">Shop</Link>
          <Link to="/account">Account</Link>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
