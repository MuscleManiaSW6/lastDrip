import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <div>
      <img src="photos.webp" alt="LASTDRIP" />
      <ul>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/products">Shop</Link>
        </li>
        <li>
          <Link to="/cart">Cart</Link>
        </li>
        <li>
          <Link to="/account">Account</Link>
        </li>
      </ul>
    </div>
  );
};

export default Navbar;
