data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
}

resource "aws_instance" "ubuntu_web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t2.micro"
}
